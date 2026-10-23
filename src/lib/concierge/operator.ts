import "server-only";
import { randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { finalMessage } from "./format";
import { scrubDeep, scrubText } from "./scrub";
import { botUsername, safeErrorText, sendMessage, telegramToken } from "./telegram";
import type { ClientStatus, DraftKind, DraftOutput, DraftStatus } from "./types";

export type DraftRow = {
  id: string;
  created_at: string;
  client_id: string;
  kind: DraftKind;
  input_summary: string;
  output: DraftOutput | Record<string, never>;
  status: DraftStatus;
  operator_note: string | null;
  decided_at: string | null;
  decided_by: string | null;
  sent_at: string | null;
  send_started_at: string | null;
  clients: { name: string; telegram_chat_id: number | null } | null;
};

export type ClientRow = {
  id: string;
  created_at: string;
  reservation_id: string | null;
  telegram_chat_id: number | null;
  name: string;
  voice_notes: string;
  apps: string[];
  status: ClientStatus;
  invite_code: string | null;
  invite_expires_at: string | null;
  linked_at: string | null;
};

export type TrackerRow = { id: string; created_at: string; client_id: string; matches_week: number | null; convos: number | null; dates_scheduled: number | null; note: string | null };

export const APP_OPTIONS = ["Tinder", "Bumble", "Hinge", "Badoo"] as const;
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_TTL_DAYS = 14;


export async function loadQueue() {
  const supabase = getSupabaseAdmin();
  const select = "id, created_at, client_id, kind, input_summary, output, status, operator_note, decided_at, decided_by, sent_at, send_started_at, clients(name, telegram_chat_id)";
  const [open, recent] = await Promise.all([
    supabase.from("drafts").select(select).in("status", ["pending", "approved", "edited", "sending", "failed"]).order("created_at", { ascending: true }).limit(200),
    supabase.from("drafts").select(select).in("status", ["sent_to_client", "rejected"]).order("decided_at", { ascending: false }).limit(15)
  ]);
  if (open.error) throw open.error;
  if (recent.error) throw recent.error;
  const rows = (open.data ?? []) as unknown as DraftRow[];
  return {
    pending: rows.filter((row) => row.status === "pending"),
    undelivered: rows.filter((row) => row.status === "approved" || row.status === "edited"),
    sending: rows.filter((row) => row.status === "sending"),
    failed: rows.filter((row) => row.status === "failed"),
    recent: (recent.data ?? []) as unknown as DraftRow[]
  };
}

export async function loadClients() {
  const supabase = getSupabaseAdmin();
  const [clients, events, drafts] = await Promise.all([
    supabase.from("clients").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("client_events").select("*").order("created_at", { ascending: true }).limit(5000),
    supabase.from("drafts").select("client_id, status").limit(10000)
  ]);
  if (clients.error) throw clients.error;
  if (events.error) throw events.error;
  if (drafts.error) throw drafts.error;
  const byClient = new Map<string, TrackerRow[]>();
  for (const event of (events.data ?? []) as TrackerRow[]) {
    byClient.set(event.client_id, [...(byClient.get(event.client_id) ?? []), event]);
  }
  const sentCount = new Map<string, number>();
  for (const row of (drafts.data ?? []) as { client_id: string; status: string }[]) {
    if (row.status === "sent_to_client") sentCount.set(row.client_id, (sentCount.get(row.client_id) ?? 0) + 1);
  }
  return ((clients.data ?? []) as ClientRow[]).map((client) => {
    const history = byClient.get(client.id) ?? [];
    return { ...client, first: history[0] ?? null, latest: history[history.length - 1] ?? null, snapshots: history.length, draftsSent: sentCount.get(client.id) ?? 0 };
  });
}

function newInviteCode() {
  return Array.from({ length: 8 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join("");
}

export function inviteLink(code: string) {
  const bot = botUsername();
  return bot ? `https://t.me/${bot}?start=${code}` : null;
}

async function reservationIdFor(email: string) {
  if (!email) return null;
  const { data, error } = await getSupabaseAdmin()
    .from("reservations").select("id").ilike("email", email).eq("status", "paid")
    .order("paid_at", { ascending: true }).limit(1).maybeSingle<{ id: string }>();
  if (error) throw error;
  return data?.id ?? null;
}

export async function createClientInvite(input: { name: string; voiceNotes: string; apps: string[]; reservationEmail: string }) {
  const reservationId = await reservationIdFor(input.reservationEmail);
  if (input.reservationEmail && !reservationId) return { error: "No paid reservation found for that email. Leave it blank or check the address." } as const;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newInviteCode();
    const { error } = await getSupabaseAdmin().from("clients").insert({
      name: input.name, voice_notes: input.voiceNotes, apps: input.apps, reservation_id: reservationId,
      invite_code: code, invite_expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString()
    });
    if (!error) return { code, link: inviteLink(code) } as const;
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique invite code");
}

export async function regenerateInvite(clientId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newInviteCode();
    const { data, error } = await getSupabaseAdmin().from("clients")
      .update({ invite_code: code, invite_expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 864e5).toISOString() })
      .eq("id", clientId).is("telegram_chat_id", null).select("id").maybeSingle();
    if (!error) return data ? ({ code, link: inviteLink(code) } as const) : ({ error: "This client is already linked to Telegram." } as const);
    if (error.code !== "23505") throw error;
  }
  throw new Error("Could not generate a unique invite code");
}

export async function updateClient(clientId: string, input: { voiceNotes: string; apps: string[]; status: ClientStatus }) {
  const { error } = await getSupabaseAdmin().from("clients")
    .update({ voice_notes: input.voiceNotes, apps: input.apps, status: input.status }).eq("id", clientId);
  if (error) throw error;
}

export async function recordTracker(clientId: string, input: { matchesWeek: number | null; convos: number | null; datesScheduled: number | null; note: string }) {
  const { error } = await getSupabaseAdmin().from("client_events").insert({
    client_id: clientId, matches_week: input.matchesWeek, convos: input.convos, dates_scheduled: input.datesScheduled, note: scrubText(input.note) || null
  });
  if (error) throw error;
}

async function loadDraft(id: string) {
  const { data, error } = await getSupabaseAdmin().from("drafts")
    .select("id, status, kind, output, client_id, clients(name, telegram_chat_id)").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Pick<DraftRow, "id" | "status" | "kind" | "output" | "client_id" | "clients"> | null;
}

/**
 * Draft lifecycle for delivery (every step is a conditional update, so two clicks, two tabs or two
 * operators can never deliver the same draft twice):
 *
 *   pending ──approve──▶ approved | edited ──claim──▶ sending ──ok──▶ sent_to_client
 *                               ▲                        │
 *                               └──── send failed ───────┘  (operator_note says why)
 *
 * "approved"/"edited" is the failed-send state: approved by an operator but not delivered.
 * Approve & send works only from "pending"; Resend works only from "approved"/"edited".
 * A draft is in "sending" only while one request owns the Telegram call.
 */
type SendResult = { ok: true; sent: boolean; notice?: string } | { ok: false; error: string };
type UndeliveredStatus = "approved" | "edited";
const UNDELIVERED: readonly UndeliveredStatus[] = ["approved", "edited"];
/** A draft still "sending" after this long lost its request (crash or restart) and may be released. */
export const STUCK_SENDING_MS = 2 * 60 * 1000;

const SCRUB_NOTICE = " Contact details (phone, @handle, email or link) were removed from the message before storing and sending.";

/** Approves a pending draft (recording an edit if the text changed), then delivers it. */
export async function approveAndSend(id: string, text: string, operator: string): Promise<SendResult> {
  const draft = await loadDraft(id);
  if (!draft) return { ok: false, error: "Draft not found." };
  if (draft.status !== "pending") return { ok: false, error: "This draft was already handled." };
  const output = draft.output as DraftOutput;
  // Browsers submit textarea line breaks as \r\n; normalise so an untouched draft isn't "edited".
  const typed = text.replace(/\r\n?/g, "\n").trim();
  if (!typed) return { ok: false, error: "The message is empty." };
  if (typed.length > 12000) return { ok: false, error: "The message is too long." };

  // What we store is what the client gets: the scrubbed text.
  const message = scrubText(typed);
  const edited = message !== (output.message ?? "").trim();
  const nextOutput = scrubDeep(edited ? { ...output, edited_message: message } : { ...output, edited_message: undefined });
  const status: UndeliveredStatus = edited ? "edited" : "approved";
  const { data: approved, error } = await getSupabaseAdmin().from("drafts")
    .update({ status, output: nextOutput, operator_note: null, decided_at: new Date().toISOString(), decided_by: operator })
    .eq("id", id).eq("status", "pending").select("id").maybeSingle();
  if (error) throw error;
  if (!approved) return { ok: false, error: "This draft was already handled." };

  const result = await deliver(id, status, draft.clients?.telegram_chat_id ?? null, finalMessage(nextOutput));
  return result.ok && message !== typed ? { ...result, notice: `${result.notice ?? (result.sent ? "Sent to the client." : "")}${SCRUB_NOTICE}`.trim() } : result;
}

/** Re-delivers a draft that was approved but not delivered. Allowed only from that state. */
export async function resendDraft(id: string): Promise<SendResult> {
  const draft = await loadDraft(id);
  if (!draft) return { ok: false, error: "Draft not found." };
  if (!UNDELIVERED.includes(draft.status as UndeliveredStatus)) {
    return { ok: false, error: draft.status === "sending" ? "This draft is being sent right now." : "Only an approved draft that wasn't delivered can be resent." };
  }
  return deliver(id, draft.status as UndeliveredStatus, draft.clients?.telegram_chat_id ?? null, finalMessage(draft.output as DraftOutput));
}

/**
 * Claims the draft (from → sending) so only this request can call Telegram, sends, then records
 * sent_to_client. On failure it reverts to `from` with an operator note, ready for Resend.
 */
async function deliver(id: string, from: UndeliveredStatus, chatId: number | null, message: string): Promise<SendResult> {
  const supabase = getSupabaseAdmin();
  const undelivered = async (note: string) => {
    const { error } = await supabase.from("drafts").update({ operator_note: note }).eq("id", id).eq("status", from);
    if (error) throw error;
  };
  if (!telegramToken()) {
    await undelivered("Not delivered: TELEGRAM_BOT_TOKEN is not set.");
    return { ok: true, sent: false, notice: "Approved. TELEGRAM_BOT_TOKEN is not set, so nothing was sent." };
  }
  if (!chatId) {
    await undelivered("Not delivered: this client has no linked Telegram chat.");
    return { ok: true, sent: false, notice: "Approved, but this client has no linked Telegram chat." };
  }
  if (!message) return { ok: false, error: "The message is empty." };

  const { data: claimed, error: claimError } = await supabase.from("drafts")
    .update({ status: "sending", send_started_at: new Date().toISOString() })
    .eq("id", id).eq("status", from).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return { ok: false, error: "This draft is already being sent or was handled. Reload the queue." };

  try {
    await sendMessage(chatId, `Your draft is ready:\n\n${message}`);
  } catch (cause) {
    const reason = scrubText(safeErrorText(cause)).slice(0, 300);
    console.error("Concierge delivery failed", id, reason);
    const { error: revertError } = await supabase.from("drafts")
      .update({ status: from, operator_note: `Telegram delivery failed at ${new Date().toISOString()}: ${reason}. Use Resend to try again.`.slice(0, 2000) })
      .eq("id", id).eq("status", "sending");
    if (revertError) throw revertError;
    return { ok: true, sent: false, notice: "Approved, but Telegram delivery failed. Use Resend to try again." };
  }

  const { error: sentError } = await supabase.from("drafts")
    .update({ status: "sent_to_client", sent_at: new Date().toISOString(), operator_note: null })
    .eq("id", id).eq("status", "sending");
  if (sentError) throw sentError;
  return { ok: true, sent: true };
}

/**
 * Releases a draft stuck in "sending" (its request died mid-send) back to the failed-send state.
 * Only after STUCK_SENDING_MS, so a live send is never interrupted. The note warns that the
 * message may have reached the client, so the operator checks before resending.
 */
export async function releaseStuckDraft(id: string) {
  const draft = await loadDraft(id);
  if (!draft || draft.status !== "sending") return false;
  const output = draft.output as DraftOutput;
  const { data, error } = await getSupabaseAdmin().from("drafts")
    .update({ status: output.edited_message ? "edited" : "approved", operator_note: "Released after a stuck send. It may already have reached the client: check the chat before resending." })
    .eq("id", id).eq("status", "sending").lt("send_started_at", new Date(Date.now() - STUCK_SENDING_MS).toISOString())
    .select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function rejectDraft(id: string, note: string, operator: string) {
  const { data, error } = await getSupabaseAdmin().from("drafts")
    .update({ status: "rejected", operator_note: scrubText(note) || null, decided_at: new Date().toISOString(), decided_by: operator })
    .eq("id", id).in("status", ["pending", "approved", "edited", "failed"]).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
