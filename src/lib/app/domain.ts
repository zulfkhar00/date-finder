// Pure domain rules for the NoSwipe app: types, validation, chat/takeover state, calendar export.
// No I/O and no server-only imports, so `npm test` (scripts/check-app.ts) can run it directly.
import { z } from "zod";

export const APPS = ["tinder", "hinge", "bumble"] as const;
export type App = (typeof APPS)[number];
export const APP_LABELS: Record<App, string> = { tinder: "Tinder", hinge: "Hinge", bumble: "Bumble" };

/**
 * What the team set for one app. setting_up -> needs_client_action -> active -> paused -> closed is the workflow the
 * operators follow (supabase/2026-11-20-fulfilment.sql). `live` is the older name for `active`; rows written before the
 * migration keep it and every reader treats the two the same.
 */
export const APP_STATUSES = ["setting_up", "needs_client_action", "active", "live", "paused", "closed"] as const;
export type AppStatus = (typeof APP_STATUSES)[number];
/** The statuses the operator console offers (the legacy `live` is read, never written by a person). */
export const WORKFLOW_STATUSES = ["setting_up", "needs_client_action", "active", "paused", "closed"] as const;
export type Sender = "match" | "as_user_ai" | "user" | "system_internal";

export type AppAccountRow = { app: App; status: AppStatus; user_paused: boolean; client_action_reason?: string | null; status_changed_at?: string | null };
/** What the user sees: their own pause toggle wins over whatever the team set. */
export function effectiveStatus(account: Pick<AppAccountRow, "status" | "user_paused">): AppStatus {
  return account.user_paused ? "paused" : account.status;
}
/** `live` and `active` mean the same thing. */
export function isActiveStatus(status: AppStatus): boolean {
  return status === "active" || status === "live";
}
/** Nothing runs for the user: they paused it, the team paused it, or it is closed. */
export function isHaltedStatus(status: AppStatus): boolean {
  return status === "paused" || status === "closed";
}
export const STATUS_LABELS: Record<AppStatus, string> = {
  setting_up: "Setting up", needs_client_action: "Needs you", active: "Active", live: "Active", paused: "Paused", closed: "Closed"
};
export const REASON_MIN = 3;
export const REASON_MAX = 200;

// --- chats and takeover ----------------------------------------------------------------------

export type TakeoverRow = { match_id: string; started_at: string; ended_at: string | null };
export type ChatMode = "ai" | "user";

/** A chat is in "user" mode while one of its takeovers has no end time. */
export function chatMode(takeovers: readonly Pick<TakeoverRow, "ended_at">[]): ChatMode {
  return takeovers.some((t) => !t.ended_at) ? "user" : "ai";
}
// Labels shown only to the signed-in user, in their own app. They never appear in a message to a match.
export const MODE_LABELS: Record<ChatMode, string> = { ai: "NoSwipe is chatting", user: "You took over" };

export type SendDecision = { ok: true } | { ok: false; reason: "taken_over" | "app_paused" | "no_takeover" };

/** Can the automation write a message as the user right now? Never during a takeover or a pause. */
export function canAiSend(mode: ChatMode, appStatus: AppStatus): SendDecision {
  if (mode === "user") return { ok: false, reason: "taken_over" };
  if (appStatus === "paused" || appStatus === "closed") return { ok: false, reason: "app_paused" };
  return { ok: true };
}
/** The user may type only after taking over. */
export function canUserSend(mode: ChatMode): SendDecision {
  return mode === "user" ? { ok: true } : { ok: false, reason: "no_takeover" };
}
export const SEND_REFUSALS: Record<Exclude<SendDecision, { ok: true }>["reason"], string> = {
  taken_over: "The user has taken over this chat. AI sends are blocked until they hand it back.",
  app_paused: "The user paused this app. AI sends are blocked until they resume it.",
  no_takeover: "Take over this chat to write messages yourself."
};

/** Messages the user typed and messages NoSwipe sent as the user are both "me". Internal notices are a separate row style. */
export function bubbleSide(sender: Sender): "them" | "me" | "system" {
  return sender === "match" ? "them" : sender === "system_internal" ? "system" : "me";
}

/** The small per-message tag on messages NoSwipe sent. Visible only to the signed-in user, never part of the message text. */
export const SENT_BY_TAG = "Sent by NoSwipe";

// --- internal notices (sender = "system_internal") ---------------------------------------------
// Notices are stored as messages so they sit in the right place in the thread, but they are never sent to
// the match, never returned to the worker API and never listed in the outbox. The body is JSON so the
// browser can format the time in the viewer's own time zone.
export type SystemEvent =
  | { kind: "took_over" }
  | { kind: "handed_back" }
  | { kind: "date_booked"; startsAt: string; venue: string };

export function encodeSystemEvent(event: SystemEvent): string {
  return JSON.stringify(event);
}
export function parseSystemEvent(body: string): SystemEvent | null {
  try {
    const v = JSON.parse(body) as Record<string, unknown>;
    if (v.kind === "took_over" || v.kind === "handed_back") return { kind: v.kind };
    if (v.kind === "date_booked" && typeof v.startsAt === "string" && typeof v.venue === "string") return { kind: "date_booked", startsAt: v.startsAt, venue: v.venue };
  } catch { /* not a notice */ }
  return null;
}
/** Text of a notice; `when` formats an ISO time for the viewer ("Thu 8:00 pm"). */
export function systemEventText(event: SystemEvent, when: (iso: string) => string): string {
  if (event.kind === "took_over") return "You took over";
  if (event.kind === "handed_back") return "Handed back";
  return `📅 Date booked · ${when(event.startsAt)} · ${event.venue}`;
}

// --- validation ------------------------------------------------------------------------------

export function ageFromBirthday(birthday: string, now = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age -= 1;
  return age;
}

const text = (max: number) => z.string().trim().max(max);
export const GENDERS = ["man", "woman", "nonbinary"] as const;
export const INTERESTED_IN = ["men", "women", "nonbinary"] as const;
export const GOALS = ["committed", "meaningful", "exploring"] as const;
export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  committed: "A relationship", meaningful: "Something real, see where it goes", exploring: "Dating around for now"
};
export const VOICES = ["warm", "playful", "direct"] as const;
export const VOICE_LABELS: Record<(typeof VOICES)[number], string> = { warm: "Warm", playful: "Playful", direct: "Direct" };

// Every answer except the birthday is optional. Blank means "not given" and is stored as null or an empty list.
// The birthday is required and must be 18 to 99 (the consent step also has an explicit 18+ box).
const blank = z.literal("");
const optInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
export const stepSchemas = {
  name: z.object({ firstName: text(60) }),
  // Birthday is required: it is the age gate (Stripe dating policy). 18 to 99 only.
  birthday: z.object({ birthday: z.string().min(1, "Add your birthday. NoSwipe is only for adults 18 or older.").refine((v) => { const a = ageFromBirthday(v); return a !== null && a >= 18 && a <= 99; }, "You need to be 18 or older.") }),
  who: z.object({ gender: z.union([blank, z.enum(GENDERS)]), interestedIn: z.array(z.enum(INTERESTED_IN)).max(3) }),
  about: z.object({
    job: text(120),
    heightCm: optInt(120, 250),
    interests: z.array(text(40).min(1)).max(3)
  }),
  type: z.object({
    city: text(120),
    ageMin: optInt(18, 99), ageMax: optInt(18, 99),
    distanceKm: optInt(1, 20000),
    lookingFor: z.union([blank, z.enum(GOALS)]),
    dealbreakers: z.array(text(60).min(1)).max(3)
  }).refine((v) => v.ageMin === null || v.ageMax === null || v.ageMin <= v.ageMax, { path: ["ageMax"], message: "Youngest age first." }),
  apps: z.object({ apps: z.array(z.enum(APPS)).max(3).transform((a) => [...new Set(a)]) })
};
export type StepName = keyof typeof stepSchemas;

export const CONSENT_VERSION = "2026-11-04";
export const CONSENT_STATEMENT = "NoSwipe creates and runs dating profiles for you on the apps you picked, using these photos, and chats as you. You can pause or take over any chat at any time.";

// --- dates ------------------------------------------------------------------------------------

export type DateRow = { id: string; who: string; venue: string; address: string | null; starts_at: string; summary: string | null; status: string };

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
/** RFC 5545 calendar file for one date; the browser builds it, the server never sees it. */
export function buildIcs(date: DateRow, durationMinutes = 120, now = new Date()): string {
  const start = new Date(date.starts_at);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NoSwipe//Dates//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${date.id}@noswipe.app`, `DTSTAMP:${icsStamp(now)}`, `DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(`Date with ${date.who}`)}`,
    `LOCATION:${icsEscape([date.venue, date.address].filter(Boolean).join(", "))}`,
    ...(date.summary ? [`DESCRIPTION:${icsEscape(date.summary)}`] : []),
    "END:VEVENT", "END:VCALENDAR"
  ];
  return lines.join("\r\n") + "\r\n";
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export const PHOTO_MIN = 3;
export const PHOTO_MAX = 6;

/** Upcoming (from three hours before the start, so a date in progress still counts) and past dates. */
export function splitDates<T extends { starts_at: string }>(dates: readonly T[], nowMs = Date.now()): { upcoming: T[]; past: T[] } {
  const cutoff = nowMs - 3 * 3600000;
  return { upcoming: dates.filter((d) => Date.parse(d.starts_at) >= cutoff), past: dates.filter((d) => Date.parse(d.starts_at) < cutoff).reverse() };
}

// Onboarding screens, in order: 0 basics (name, birthday, who), 1 apps (guests see the email code here first),
// 2 about, 3 type, 4 photos, 5 consent, 6 early access.
export const CONSENT_STEP = 5;
export const PAY_STEP = 6;
