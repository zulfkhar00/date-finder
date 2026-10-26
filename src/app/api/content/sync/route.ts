import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CONTENT_PREVIEW_BUCKET, previewPath, syncRequestSchema } from "@/lib/content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-way sync for /admin/videos. The posting-queue job POSTs every video it knows about plus the
// admin requests it has applied; we upsert content_posts, close those content_actions, and answer
// with the requests still open and short-lived signed upload URLs for previews it wants to send.
// Bearer CONTENT_SYNC_TOKEN only; without that env var the route does not exist (404).

function sha(value: string): Uint8Array {
  return new Uint8Array(createHash("sha256").update(value).digest());
}

function authorized(request: Request, token: string): boolean {
  return timingSafeEqual(sha(request.headers.get("authorization") ?? ""), sha(`Bearer ${token}`));
}

export async function POST(request: Request) {
  const token = process.env.CONTENT_SYNC_TOKEN?.trim();
  if (!token || token.length < 32) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!authorized(request, token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = syncRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return NextResponse.json({ error: "Invalid payload", issues }, { status: 400 });
  }
  const { posts, done } = parsed.data;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (posts.length > 0) {
    const rows = posts.map((post) => ({
      external_ref: post.external_ref,
      title: post.title,
      caption: post.caption,
      status: post.status,
      scheduled_at: post.scheduled_at,
      posted_at: post.posted_at,
      post_url: post.post_url,
      submitted_by: post.submitted_by,
      source: post.source,
      fixes: post.fixes,
      duration_s: post.duration_s,
      created_at: post.created_at,
      preview_path: post.preview ? previewPath(post.external_ref, post.preview.ext) : null,
      updated_at: now
    }));
    const { error } = await supabase.from("content_posts").upsert(rows, { onConflict: "external_ref" });
    if (error) {
      console.error("Content sync upsert failed", error.code ?? "unknown");
      return NextResponse.json({ error: "Upsert failed", code: error.code ?? null }, { status: 500 });
    }
  }

  for (const item of done) {
    const { error } = await supabase
      .from("content_actions")
      .update({ done_at: now, result: item.result })
      .eq("id", item.id)
      .is("done_at", null);
    if (error) console.error("Content sync action close failed", error.code ?? "unknown");
  }

  const uploads: Record<string, { path: string; url: string }> = {};
  for (const post of posts) {
    if (!post.preview?.upload) continue;
    const path = previewPath(post.external_ref, post.preview.ext);
    const { data, error } = await supabase.storage.from(CONTENT_PREVIEW_BUCKET).createSignedUploadUrl(path, { upsert: true });
    if (error || !data) {
      console.error("Content sync upload URL failed", error?.name ?? "unknown");
      continue;
    }
    uploads[post.external_ref] = { path, url: data.signedUrl };
  }

  const { data: open, error: openError } = await supabase
    .from("content_actions")
    .select("id, action, requested_by, created_at, content_posts!inner(external_ref, status)")
    .is("done_at", null)
    .order("created_at", { ascending: true })
    .limit(100);
  if (openError) console.error("Content sync open actions failed", openError.code ?? "unknown");

  const actions = (open ?? []).map((row) => {
    const post = Array.isArray(row.content_posts) ? row.content_posts[0] : row.content_posts;
    return {
      id: row.id as string,
      action: row.action as string,
      requested_by: row.requested_by as string,
      created_at: row.created_at as string,
      external_ref: (post?.external_ref as string | undefined) ?? null,
      status: (post?.status as string | undefined) ?? null
    };
  });

  return NextResponse.json({ ok: true, upserted: posts.length, closed: done.length, actions, uploads });
}
