import { after, NextResponse } from "next/server";
import { userOrNull } from "@/lib/app/session";
import { cleanPasted, intakeImages } from "@/lib/reply-helper/images";
import { isTweak } from "@/lib/reply-helper/prompts";
import { deleteThread, loadThread, runReplyFor, trackReplyEvent } from "@/lib/reply-helper/service";
import { MAX_IMAGES, MAX_TEXT_CHARS, type ReplyInput } from "@/lib/reply-helper/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby ceiling; a run keeps its own 56 s budget and fails friendly before it

const HEADERS = { "Cache-Control": "no-store" };
const UUID = /^[0-9a-f-]{36}$/i;
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: HEADERS });

const MESSAGES = {
  unreadable: "We couldn't read that chat. Try a clearer screenshot with the messages fully in view, or paste the text.",
  refused: "We can't write replies for that conversation. NoSwipe only helps with respectful messages, and never to pressure or chase someone.",
  cap: "The reply helper is at capacity today. It opens again tomorrow, and your starter pack is still here.",
  user_limit: "You've used today's reply sessions. Come back tomorrow.",
  busy: "Your last request is still being written. Give it a moment.",
  failed: "The helper couldn't finish that. Nothing was lost, try again in a minute.",
  unconfigured: "The reply helper isn't available right now. Try again later."
} as const;

// POST multipart: files (1-4 screenshots) and/or text for a new thread, or threadId + kind=regenerate|tweak (+ tweak)
// to rewrite the drafts of a saved one from the text we already read (no screenshot is kept, so none is needed again).
export async function POST(request: Request) {
  const user = await userOrNull();
  if (!user) return json({ error: "Your session ended. Sign in again." }, 401);

  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "That upload didn't work. Try smaller screenshots." }, 400); }

  const kind = form.get("kind");
  let input: ReplyInput;
  if (kind === "regenerate" || kind === "tweak") {
    const threadId = form.get("threadId");
    const tweak = form.get("tweak");
    if (typeof threadId !== "string" || !UUID.test(threadId)) return json({ error: "Open the thread again." }, 400);
    if (kind === "tweak" && !isTweak(tweak)) return json({ error: "Pick one of the options." }, 400);
    let thread;
    try { thread = await loadThread(user.id, threadId); } catch { return json({ code: "failed", error: MESSAGES.failed }, 502); }
    if (!thread) return json({ error: "That thread is gone." }, 404);
    input = { kind, thread, tweak: kind === "tweak" && isTweak(tweak) ? tweak : null };
  } else {
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > MAX_IMAGES) return json({ error: `Add up to ${MAX_IMAGES} screenshots.` }, 400);
    const text = cleanPasted(form.get("text"), MAX_TEXT_CHARS);
    if (files.length === 0 && text.length < 8) return json({ error: "Add a screenshot of the chat, or paste the conversation." }, 400);
    const bytes = await Promise.all(files.map(async (f) => new Uint8Array(await f.arrayBuffer())));
    const intake = intakeImages(bytes);
    if (!intake.ok) return json({ error: intake.error }, intake.status);
    if (intake.images.length === 0 && text.length < 8) return json({ error: "Add a screenshot of the chat, or paste the conversation." }, 400);
    input = { kind: "new", images: intake.images, text };
  }

  const outcome = await runReplyFor(user.id, input);
  switch (outcome.status) {
    case "ok":
      after(() => trackReplyEvent("reply_helper_used"));
      return json({ thread: outcome.thread });
    case "unreadable": return json({ code: "unreadable", error: MESSAGES.unreadable }, 422);
    case "refused": return json({ code: "refused", error: MESSAGES.refused }, 422);
    case "denied": return json({ code: outcome.reason, error: MESSAGES[outcome.reason] }, outcome.reason === "busy" ? 409 : 429);
    case "unconfigured": return json({ code: "unconfigured", error: MESSAGES.unconfigured }, 503);
    default: return json({ code: "failed", error: MESSAGES.failed }, 502);
  }
}

// DELETE ?id=<thread>: the user removes a saved thread (their drafts and the lines we read from the chat).
export async function DELETE(request: Request) {
  const user = await userOrNull();
  if (!user) return json({ error: "Your session ended. Sign in again." }, 401);
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) return json({ error: "Open the thread again." }, 400);
  const ok = await deleteThread(user.id, id).catch(() => false);
  return ok ? json({ ok: true }) : json({ error: "Couldn't delete that. Try again." }, 404);
}
