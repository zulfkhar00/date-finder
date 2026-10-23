import "server-only";
import { randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { finalMessage } from "./format";
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

export function storageConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export async function loadQueue() {
  const supabase = getSupabaseAdmin();
  const select = "id, created_at, client_id, kind, input_summary, output, status, operator_note, decided_at, decided_by, sent_at, clients(name, telegram_chat_id)";
  const [open, recent] = await Promise.all([
    supabase.from("drafts").select(select).in("status", ["pending", "approved", "edited", "failed"]).order("created_at", { ascending: true }).limit(200),
    supabase.from("drafts").select(select).in("status", ["sent_to_client", "rejected"]).order("decided_at", { ascending: false }).limit(15)
  ]);
  if (open.error) throw open.error;
  if (recent.error) throw recent.error;
  const rows = (open.data ?? []) as unknown as DraftRow[];
  return {
    pending: rows.filter((row) => row.status === "pending"),
    undelivered: rows.filter((row) => row.status === "approved" || row.status === "edited"),
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
    client_id: clientId, matches_week: input.matchesWeek, convos: input.convos, dates_scheduled: input.datesScheduled, note: input.note || null
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
 * Approves a draft (recording an edit if the text changed) and delivers it to the client on
 * Telegram. The client then sends it himself. If delivery fails, the draft stays approved and
 * can be re-sent from the console.
 */
export async function approveAndSend(id: string, text: string, operator: string): Promise<{ ok: true; sent: boolean; notice?: string } | { ok: false; error: string }> {
  const draft = await loadDraft(id);
  if (!draft) return { ok: false, error: "Draft not found." };
  if (!["pending", "approved", "edited"].includes(draft.status)) return { ok: false, error: "This draft was already handled." };
  const output = draft.output as DraftOutput;
  const message = text.trim();
  if (!message) return { ok: false, error: "The message is empty." };
  if (message.length > 12000) return { ok: false, error: "The message is too long." };

  const edited = message !== (output.message ?? "").trim();
  const nextOutput = edited ? { ...output, edited_message: message } : { ...output, edited_message: undefined };
  const { data: claimed, error } = await getSupabaseAdmin().from("drafts")
    .update({ status: edited ? "edited" : "approved", output: nextOutput, decided_at: new Date().toISOString(), decided_by: operator })
    .eq("id", id).in("status", ["pending", "approved", "edited"]).select("id").maybeSingle();
  if (error) throw error;
  if (!claimed) return { ok: false, error: "This draft was already handled." };

  const chatId = draft.clients?.telegram_chat_id;
  if (!telegramToken()) return { ok: true, sent: false, notice: "Approved. TELEGRAM_BOT_TOKEN is not set, so nothing was sent." };
  if (!chatId) return { ok: true, sent: false, notice: "Approved, but this client has no linked Telegram chat." };
  try {
    await sendMessage(chatId, `Your draft is ready:\n\n${finalMessage(nextOutput)}`);
  } catch (cause) {
    console.error("Concierge delivery failed", id, safeErrorText(cause));
    return { ok: true, sent: false, notice: "Approved, but Telegram delivery failed. Use Resend to try again." };
  }
  const { error: sentError } = await getSupabaseAdmin().from("drafts")
    .update({ status: "sent_to_client", sent_at: new Date().toISOString() }).eq("id", id);
  if (sentError) throw sentError;
  return { ok: true, sent: true };
}

export async function rejectDraft(id: string, note: string, operator: string) {
  const { data, error } = await getSupabaseAdmin().from("drafts")
    .update({ status: "rejected", operator_note: note || null, decided_at: new Date().toISOString(), decided_by: operator })
    .eq("id", id).in("status", ["pending", "approved", "edited", "failed"]).select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
