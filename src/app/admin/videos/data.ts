import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CONTENT_PREVIEW_BUCKET, type ContentPost, type OpenContentAction } from "@/lib/content";
import { AdminDataError } from "../_lib/data";

const PREVIEW_TTL_S = 600;

export type VideosData = {
  posts: ContentPost[];
  open: Map<string, OpenContentAction>;
  previews: Map<string, string>;
};

/** Every mirrored video (newest 400), open admin requests, and 10-minute signed preview URLs. */
export async function getVideos(): Promise<VideosData> {
  const supabase = getSupabaseAdmin();
  const [postsRes, actionsRes] = await Promise.all([
    supabase
      .from("content_posts")
      .select("id, title, caption, status, scheduled_at, posted_at, post_url, submitted_by, source, fixes, preview_path, duration_s, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(400),
    supabase.from("content_actions").select("id, post_id, action, requested_by, created_at").is("done_at", null)
  ]);
  if (postsRes.error) {
    console.error("Admin query failed", "content_posts", postsRes.error.code ?? "unknown");
    throw new AdminDataError("content_posts", postsRes.error.code);
  }
  if (actionsRes.error) console.error("Admin query failed", "content_actions", actionsRes.error.code ?? "unknown");

  const posts = (postsRes.data ?? []) as ContentPost[];
  const open = new Map<string, OpenContentAction>();
  for (const action of (actionsRes.data ?? []) as OpenContentAction[]) open.set(action.post_id, action);

  const previews = new Map<string, string>();
  const paths = posts.map((post) => post.preview_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { data, error } = await supabase.storage.from(CONTENT_PREVIEW_BUCKET).createSignedUrls(paths, PREVIEW_TTL_S);
    if (error) console.error("Admin preview URLs failed", error.name);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) previews.set(item.path, item.signedUrl);
    }
  }
  return { posts, open, previews };
}

export type RequestResult = "ok" | "already" | "wrong_status" | "missing" | "unavailable";

/** Files an admin request; the sync applies it on its next pass. One open request per video. */
export async function requestAction(postId: string, action: "post_anyway" | "dont_post", fromStatus: string, email: string): Promise<RequestResult> {
  const supabase = getSupabaseAdmin();
  const { data: post, error } = await supabase.from("content_posts").select("id, status").eq("id", postId).maybeSingle();
  if (error) {
    console.error("Admin query failed", "content_posts", error.code ?? "unknown");
    return "unavailable";
  }
  if (!post) return "missing";
  if (post.status !== fromStatus) return "wrong_status";

  const { error: insertError } = await supabase.from("content_actions").insert({ post_id: postId, action, requested_by: email });
  if (insertError?.code === "23505") return "already";
  if (insertError) {
    console.error("Admin query failed", "content_actions", insertError.code ?? "unknown");
    return "unavailable";
  }
  return "ok";
}
