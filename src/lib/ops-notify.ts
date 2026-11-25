import "server-only";
import { after } from "next/server";
import { scrubString } from "@/lib/scrub";

// Ops alerts into the founders' Telegram forum group, one topic per kind. Server only: the bot
// token never reaches the browser. Off while NOSWIPE_OPS_BOT_TOKEN or NOSWIPE_OPS_CHAT_ID is unset.
// Every send is best-effort: a Telegram problem never fails or slows the request that caused it.

// reports shares the errors topic until a dedicated forum topic id is set in NOSWIPE_OPS_REPORTS_TOPIC_ID.
export const OPS_TOPICS = { signups: 2, payments: 3, traffic: 4, errors: 5, reports: 5 } as const;
export type OpsTopic = keyof typeof OPS_TOPICS;

const SEND_TIMEOUT_MS = 4000;
const ERROR_REPEAT_MS = 10 * 60_000;
const MAX_TRACKED = 500;

const recentErrors = new Map<string, number>();
const seenKeys = new Set<string>();

function topicId(topic: OpsTopic): number {
  if (topic !== "reports") return OPS_TOPICS[topic];
  const custom = Number(process.env.NOSWIPE_OPS_REPORTS_TOPIC_ID);
  return Number.isInteger(custom) && custom > 0 ? custom : OPS_TOPICS.reports;
}

function config() {
  const token = process.env.NOSWIPE_OPS_BOT_TOKEN?.trim();
  const chatId = process.env.NOSWIPE_OPS_CHAT_ID?.trim();
  return token && chatId ? { token, chatId } : null;
}

/** Sends now and waits for it (bounded by a timeout). Never throws. Logs status codes only. */
export async function sendOps(topic: OpsTopic, text: string): Promise<boolean> {
  const cfg = config();
  if (!cfg) return false;
  try {
    const response = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: cfg.chatId, message_thread_id: topicId(topic), text: text.slice(0, 3500), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    if (!response.ok) console.error("Ops notify failed", topic, response.status);
    return response.ok;
  } catch (error) {
    console.error("Ops notify failed", topic, error instanceof Error ? error.name : "unknown error");
    return false;
  }
}

/**
 * Fire-and-forget: runs the send after the response is finished. With a dedupeKey (e.g. a Stripe
 * event id) a repeat within this instance is dropped. Never throws.
 */
export function notifyOps(topic: OpsTopic, text: string, dedupeKey?: string): void {
  try {
    if (!config()) return;
    if (dedupeKey) {
      if (seenKeys.has(dedupeKey)) return;
      if (seenKeys.size >= MAX_TRACKED) seenKeys.clear();
      seenKeys.add(dedupeKey);
    }
    after(() => sendOps(topic, text).then(() => undefined));
  } catch {
    // after() outside a request scope, or anything else: alerts are optional.
  }
}

/** Server error in an API route. The same route + message posts at most once per 10 minutes. */
export function notifyOpsError(route: string, message: string): void {
  try {
    const text = `${route}\n${scrubString(message).slice(0, 300)}`;
    const now = Date.now();
    const last = recentErrors.get(text);
    if (last !== undefined && now - last < ERROR_REPEAT_MS) return;
    if (recentErrors.size >= MAX_TRACKED) recentErrors.clear();
    recentErrors.set(text, now);
    notifyOps("errors", `⚠️ ${text}`);
  } catch {
    // never let alerting break the caller
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "code" in error) return `code ${String((error as { code: unknown }).code)}`;
  return "unknown error";
}

/** True when the ops bot token and chat id are set, so a caller can skip claiming an alert nobody could receive. */
export function opsConfigured(): boolean {
  return config() !== null;
}
