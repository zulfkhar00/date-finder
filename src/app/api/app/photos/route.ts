import { NextResponse } from "next/server";
import { PHOTO_MAX } from "@/lib/app/domain";
import { ensureProfile } from "@/lib/app/actions-core";
import { signUrls } from "@/lib/app/data";
import { livePhotoRows } from "@/lib/starter-pack/photo-flags";
import { userOrNull } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
const MAX_BYTES = 4 * 1024 * 1024; // Vercel rejects bodies over 4.5 MB; the browser resizes to ~400 KB first.

function sniff(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}

// POST multipart {file}: stores one profile photo in the private bucket under <user id>/ and returns its row.
export async function POST(request: Request) {
  const user = await userOrNull();
  if (!user) return NextResponse.json({ error: "Your session ended. Sign in again." }, { status: 401 });
  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return NextResponse.json({ error: "That upload didn't work. Try a smaller photo." }, { status: 400 });
  }
  if (!file || file.size === 0) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "That photo is too large." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniff(bytes);
  if (!kind) return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 415 });

  const sb = getSupabaseAdmin();
  await ensureProfile(sb, user.id, user.email);
  const existing = (await livePhotoRows<{ position: number }>(sb, user.id, "position")).reverse(); // soft-deleted photos do not count
  if (existing.length >= PHOTO_MAX) return NextResponse.json({ error: `You can add up to ${PHOTO_MAX} photos.` }, { status: 409 });
  const path = `${user.id}/${crypto.randomUUID()}.${kind.ext}`;
  const up = await sb.storage.from("profile-photos").upload(path, bytes, { contentType: kind.type, upsert: false });
  if (up.error) return NextResponse.json({ error: "Couldn't store that photo. Try again." }, { status: 500 });
  const { data, error } = await sb.from("profile_photos").insert({ user_id: user.id, path, position: (existing?.[0]?.position ?? -1) + 1 }).select("id, path, position").single();
  if (error || !data) {
    await sb.storage.from("profile-photos").remove([path]);
    return NextResponse.json({ error: "Couldn't save that photo. Try again." }, { status: 500 });
  }
  const urls = await signUrls(sb, [path]);
  return NextResponse.json({ photo: { ...data, url: urls.get(path) ?? null } }, { headers: { "Cache-Control": "no-store" } });
}
