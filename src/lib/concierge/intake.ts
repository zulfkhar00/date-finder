import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { draft, hasAnthropicKey, type DraftImage } from "./draft";
import { downloadImage, imageFileId, safeErrorText, sendMessageQuietly, type TelegramMessage, type TelegramUpdate } from "./telegram";
import { KIND_LABELS, parseCaption, type DraftKind } from "./types";

type ClientRow = { id: string; name: string; voice_notes: string; apps: string[]; status: string };
type Job = { chatId: number; client: ClientRow; kind: DraftKind | null; note: string; fileIds: string[] };

const MAX_IMAGES_PER_JOB = 10;
/** Telegram delivers each photo of an album as its own update; wait this long to collect them. */
const ALBUM_WINDOW_MS = 2500;

const HELP = [
  "How this works:",
  "Send a screenshot with a one-word caption and we draft it for you.",
  "",
  "profile - your photos and current profile: we rank photos and write your bio",
  "opener - her profile: three openers",
  "reply - your chat: your next message",
  "date - your chat: a date plan and the message to send",
  "",
  "You can add a note after the word, e.g. \"date we're both near downtown\".",
  "A person reviews every draft. You always send messages yourself. We delete screenshots once the draft is written."
].join("\n");

const albums = new Map<string, Job>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Records the update id so Telegram retries are ignored. Returns false for a duplicate delivery.
 */
export async function claimUpdate(updateId: number) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("telegram_updates").insert({ update_id: updateId });
  if (error?.code === "23505") return false;
  if (error) throw error;
  if (Math.random() < 0.02) {
    await supabase.from("telegram_updates").delete().lt("received_at", new Date(Date.now() - 7 * 864e5).toISOString());
  }
  return true;
}

/** Undoes claimUpdate so a retried delivery is processed after a failure. */
export async function releaseUpdate(updateId: number) {
  await getSupabaseAdmin().from("telegram_updates").delete().eq("update_id", updateId);
}

/**
 * Handles one Telegram update. Returns an optional task to run after the HTTP response,
 * so Telegram gets its 200 quickly while drafting runs in the background.
 */
export async function handleUpdate(update: TelegramUpdate): Promise<(() => Promise<void>) | null> {
  const message = update.message;
  if (!message || message.chat.type !== "private") return null;
  const chatId = message.chat.id;
  const text = message.text?.trim() ?? "";

  if (text.startsWith("/start")) return () => linkChat(chatId, text.split(/\s+/)[1] ?? "");
  if (text === "/help") return () => sendMessageQuietly(chatId, HELP);

  const client = await findClient(chatId);
  if (!client) {
    return () => sendMessageQuietly(chatId, "Hi! This is a private pilot. Open the invite link you were sent, or send /start followed by your invite code.");
  }
  if (client.status !== "pilot") {
    return () => sendMessageQuietly(chatId, "Your pilot is paused right now, so we are not drafting. Reach out to your concierge to pick it back up.");
  }

  const fileId = imageFileId(message);
  if (message.media_group_id && fileId) return collectAlbum(chatId, client, message, fileId);

  const { kind, note } = parseCaption(message.caption ?? message.text);
  if (fileId) {
    if (!kind) return () => sendMessageQuietly(chatId, "Got the screenshot. Send it again with a caption so we know what you need: profile, opener, reply or date.");
    return () => runJob({ chatId, client, kind, note, fileIds: [fileId] });
  }
  if (message.photo || message.document) {
    return () => sendMessageQuietly(chatId, "That file didn't come through as an image we can read. Send a screenshot (JPG or PNG, under 5 MB).");
  }
  if (kind && note.length >= 10) return () => runJob({ chatId, client, kind, note, fileIds: [] });
  return () => sendMessageQuietly(chatId, HELP);
}

function collectAlbum(chatId: number, client: ClientRow, message: TelegramMessage, fileId: string) {
  const key = `${chatId}:${message.media_group_id}`;
  const existing = albums.get(key);
  const { kind, note } = parseCaption(message.caption);
  if (existing) {
    if (existing.fileIds.length < MAX_IMAGES_PER_JOB) existing.fileIds.push(fileId);
    if (!existing.kind && kind) Object.assign(existing, { kind, note });
    return null;
  }
  const job: Job = { chatId, client, kind, note, fileIds: [fileId] };
  albums.set(key, job);
  return async () => {
    await sleep(ALBUM_WINDOW_MS);
    albums.delete(key);
    if (!job.kind) {
      await sendMessageQuietly(chatId, "Got the screenshots. Send them again with a caption on the first one: profile, opener, reply or date.");
      return;
    }
    await runJob(job);
  };
}

async function findClient(chatId: number) {
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .select("id, name, voice_notes, apps, status")
    .eq("telegram_chat_id", chatId)
    .maybeSingle<ClientRow>();
  if (error) throw error;
  return data;
}

async function linkChat(chatId: number, rawCode: string) {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const existing = await findClient(chatId);
  if (existing) {
    await sendMessageQuietly(chatId, `You're already set up, ${existing.name}.\n\n${HELP}`);
    return;
  }
  if (!/^[A-Z2-9]{8}$/.test(code)) {
    await sendMessageQuietly(chatId, "Send /start followed by the invite code you were given.");
    return;
  }
  const { data, error } = await getSupabaseAdmin()
    .from("clients")
    .update({ telegram_chat_id: chatId, invite_code: null, invite_expires_at: null, linked_at: new Date().toISOString() })
    .eq("invite_code", code)
    .is("telegram_chat_id", null)
    .gt("invite_expires_at", new Date().toISOString())
    .select("name")
    .maybeSingle<{ name: string }>();
  if (error) {
    console.error("Concierge invite link failed", safeErrorText(error));
    await sendMessageQuietly(chatId, "Something went wrong linking your invite. Try again in a minute.");
    return;
  }
  if (!data) {
    await sendMessageQuietly(chatId, "That invite code didn't work. It may have expired or already been used. Ask your concierge for a new one.");
    return;
  }
  await sendMessageQuietly(chatId, `Welcome, ${data.name}. You're in the pilot.\n\n${HELP}`);
}

async function runJob(job: Job) {
  const kind = job.kind as DraftKind;
  await sendMessageQuietly(job.chatId, `Got it. Your ${KIND_LABELS[kind].toLowerCase()} draft is coming soon.`);
  const supabase = getSupabaseAdmin();

  if (!hasAnthropicKey()) {
    await supabase.from("drafts").insert({
      client_id: job.client.id, kind, status: "failed",
      input_summary: `${job.fileIds.length} image(s) received; not drafted.`,
      operator_note: "ANTHROPIC_API_KEY is not set, so nothing was drafted. Ask the client to resend once it is configured."
    });
    return;
  }

  let images: DraftImage[] = [];
  try {
    for (const fileId of job.fileIds.slice(0, MAX_IMAGES_PER_JOB)) {
      const image = await downloadImage(fileId);
      if (image) images.push(image);
    }
    if (job.fileIds.length && !images.length) {
      await sendMessageQuietly(job.chatId, "We couldn't read that image. Send a screenshot (JPG or PNG, under 5 MB).");
      return;
    }
    const result = await draft({
      kind,
      client: { name: job.client.name, voiceNotes: job.client.voice_notes, apps: job.client.apps },
      images,
      note: job.note
    });
    images = []; // drop the only reference to the image bytes as soon as drafting is done
    if (!result) throw new Error("Drafting is not configured");
    const { error } = await supabase.from("drafts").insert({
      client_id: job.client.id, kind, status: "pending", input_summary: result.inputSummary, output: result.output
    });
    if (error) throw error;
  } catch (error) {
    images = [];
    console.error("Concierge draft failed", kind, safeErrorText(error));
    await supabase.from("drafts").insert({
      client_id: job.client.id, kind, status: "failed",
      input_summary: `${job.fileIds.length} image(s) received; drafting failed.`,
      operator_note: `Drafting failed: ${safeErrorText(error)}`.slice(0, 2000)
    });
    await sendMessageQuietly(job.chatId, "Something went wrong with that one. Please send it again in a few minutes.");
  }
}
