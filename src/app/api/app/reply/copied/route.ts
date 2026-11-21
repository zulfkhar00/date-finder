import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { userOrNull } from "@/lib/app/session";
import { trackReplyEvent } from "@/lib/reply-helper/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST: the user copied a draft. Records the `reply_copied` funnel event (name only, no text, no thread content).
// One per user per minute at most: a rapid series of copies counts once. The dedupe key holds a hash, never the user id.
export async function POST() {
  const user = await userOrNull();
  if (!user) return new NextResponse(null, { status: 401 });
  await trackReplyEvent("reply_copied", `reply_copied:${createHash("sha256").update(user.id).digest("hex").slice(0, 16)}:${Math.floor(Date.now() / 60_000)}`);
  return new NextResponse(null, { status: 204 });
}
