// Pure rules for the done-for-you fulfilment queue: who is waiting, for how long, in what order, and when an operator
// must be told. No I/O and no server-only imports, so `npm test` (scripts/check-fulfilment.ts) runs it directly.
import { isPaidCountry } from "@/lib/paid-countries";
import { APPS, REASON_MAX, REASON_MIN, WORKFLOW_STATUSES, APP_STATUSES, APP_LABELS, type App, type AppStatus } from "@/lib/app/domain";

export const HOUR_MS = 3_600_000;
/** SLA badge: green under 24 h, amber from 24 h to 72 h, red over 72 h. 72 h is also what the client is told. */
export const SLA_AMBER_HOURS = 24;
export const SLA_RED_HOURS = 72;
export type SlaTone = "green" | "amber" | "red";

export function slaTone(hours: number): SlaTone {
  return hours > SLA_RED_HOURS ? "red" : hours >= SLA_AMBER_HOURS ? "amber" : "green";
}
export const SLA_LABELS: Record<SlaTone, string> = { green: "Under 24 h", amber: "24 to 72 h", red: "Over 72 h" };

export type QueueApp = { app: App; status: AppStatus; userPaused: boolean; reason: string | null; changedAt: string | null };
export type CountrySupport = "supported" | "unsupported" | "unknown";

export type QueueInput = {
  userId: string;
  firstName: string | null;
  email: string;
  createdAt: string;
  onboardingDoneAt: string;
  paid: boolean;
  paidAt: string | null;
  /** Billing country when paid, else the country the checkout was opened from. Two letters or null. */
  country: string | null;
  apps: QueueApp[];
  packStatus: string | null;
  photoCount: number;
  flaggedPhotos: number;
  /** A takedown report put the account on hold. It overrides every app status. */
  hold: "paused" | "closed" | null;
  lastEventAt: string | null;
};

export type QueueRow = QueueInput & {
  countrySupport: CountrySupport;
  /** When the wait started: onboarding, or payment if that came later (the 72 h promise starts when the client pays). */
  waitingSince: string;
  hoursWaiting: number;
  sla: SlaTone;
};

export function ts(iso: string | null | undefined): number {
  const n = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export function countrySupport(country: string | null, list?: readonly string[]): CountrySupport {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return "unknown";
  return isPaidCountry(country, list) ? "supported" : "unsupported";
}

export function waitingSinceOf(input: Pick<QueueInput, "onboardingDoneAt" | "paid" | "paidAt">): string {
  const done = ts(input.onboardingDoneAt);
  const paid = input.paid ? ts(input.paidAt) : NaN;
  if (Number.isFinite(paid) && (!Number.isFinite(done) || paid > done)) return input.paidAt as string;
  return input.onboardingDoneAt;
}

export function buildRow(input: QueueInput, now: Date, list?: readonly string[]): QueueRow {
  const waitingSince = waitingSinceOf(input);
  const ms = Math.max(0, now.getTime() - (ts(waitingSince) || now.getTime()));
  const hoursWaiting = Math.floor(ms / HOUR_MS);
  return { ...input, countrySupport: countrySupport(input.country, list), waitingSince, hoursWaiting, sla: slaTone(hoursWaiting) };
}

/** Rows that still need a first human touch are the ones the SLA badge is about. A held, active or closed client is not "waiting". */
export function isWaiting(row: Pick<QueueRow, "hold" | "apps">): boolean {
  if (row.hold) return false;
  if (row.apps.length === 0) return true;
  return row.apps.some((a) => !a.userPaused && (a.status === "setting_up" || a.status === "awaiting_login"));
}

/**
 * Order: accounts on a report hold last (not a fulfilment job), then paid before unpaid, unpaid clients in a supported
 * country before unpaid clients outside the list (they cannot pay yet), then the longest wait first.
 */
export function compareQueue(a: QueueRow, b: QueueRow): number {
  const held = Number(!!a.hold) - Number(!!b.hold);
  if (held) return held;
  const paid = Number(b.paid) - Number(a.paid);
  if (paid) return paid;
  if (!a.paid) {
    const rank = (r: QueueRow) => (r.countrySupport === "unsupported" ? 1 : 0);
    const country = rank(a) - rank(b);
    if (country) return country;
  }
  const waiting = Number(isWaiting(b)) - Number(isWaiting(a));
  if (waiting) return waiting;
  return (ts(a.waitingSince) || 0) - (ts(b.waitingSince) || 0);
}

export type QueueFilters = { paid: "paid" | "unpaid" | null; country: CountrySupport | null; app: App | null };

export function parseFilters(search: { paid?: string; country?: string; app?: string }): QueueFilters {
  return {
    paid: search.paid === "paid" || search.paid === "unpaid" ? search.paid : null,
    country: search.country === "supported" || search.country === "unsupported" || search.country === "unknown" ? search.country : null,
    app: (APPS as readonly string[]).includes(search.app ?? "") ? (search.app as App) : null
  };
}

export function applyFilters(rows: QueueRow[], f: QueueFilters): QueueRow[] {
  return rows
    .filter((r) => (f.paid === null ? true : f.paid === "paid" ? r.paid : !r.paid))
    .filter((r) => (f.country === null ? true : r.countrySupport === f.country))
    .filter((r) => (f.app === null ? true : r.apps.some((a) => a.app === f.app)));
}

/** Short status text of one app as the operator sees it. A report hold wins over everything the team set. */
export function appStatusLabel(a: QueueApp, hold: QueueRow["hold"]): string {
  if (hold) return hold === "closed" ? "closed (report)" : "paused (report)";
  if (a.userPaused) return "paused (user)";
  return a.status === "live" ? "active" : a.status.replace(/_/g, " ");
}

// --- status changes --------------------------------------------------------------------------

export type StatusChange = { status: AppStatus; reason: string | null };

/**
 * Validates an operator's (or the worker's) status change. needs_client_action needs a reason the client will read; every
 * other status drops the reason so a stale "Add 2 more photos" can never show under "Active".
 */
export function parseStatusChange(input: { status: unknown; reason?: unknown }, opts: { allowLegacy?: boolean } = {}): { ok: true; change: StatusChange } | { ok: false; error: string } {
  const allowed: readonly string[] = opts.allowLegacy ? APP_STATUSES : WORKFLOW_STATUSES;
  if (typeof input.status !== "string" || !allowed.includes(input.status)) return { ok: false, error: "Unknown status." };
  const status = input.status as AppStatus;
  if (status !== "needs_client_action") return { ok: true, change: { status, reason: null } };
  const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length < REASON_MIN) return { ok: false, error: "Write what the client needs to do. They read it on their Home screen." };
  if (reason.length > REASON_MAX) return { ok: false, error: `Keep the reason under ${REASON_MAX} characters.` };
  return { ok: true, change: { status, reason } };
}

export const NOTE_MAX = 2000;
export function parseNote(value: unknown): string | null {
  const note = typeof value === "string" ? value.trim() : "";
  return note.length >= 1 && note.length <= NOTE_MAX ? note : null;
}

// --- ops alert --------------------------------------------------------------------------------

/**
 * A paid client the team has not touched: still waiting more than 24 h after onboarding or payment (whichever is later) and
 * no app has changed status since. A report hold, a client who is not paid, or an app someone already moved are never alerted.
 */
export function needsAlert(row: QueueRow): boolean {
  if (!row.paid || !isWaiting(row)) return false;
  if (row.hoursWaiting < SLA_AMBER_HOURS) return false;
  const since = ts(row.waitingSince);
  const touched = row.apps.some((a) => Number.isFinite(ts(a.changedAt)) && ts(a.changedAt) >= since) || (Number.isFinite(ts(row.lastEventAt)) && ts(row.lastEventAt) >= since);
  return !touched;
}

/** The claim key: one alert per client per UTC day. */
export function alertKey(userId: string, now: Date): string {
  return `alert:${userId}:${now.toISOString().slice(0, 10)}`;
}

/** One line, no name and no email: the id in the link is enough for an operator. */
export function opsLine(row: Pick<QueueRow, "hoursWaiting" | "apps">, link: string): string {
  const apps = row.apps.length ? row.apps.map((a) => APP_LABELS[a.app]).join(", ") : "no apps chosen";
  return `⏳ Paid client waiting ${row.hoursWaiting} h with no status change (${apps}). ${link}`;
}
