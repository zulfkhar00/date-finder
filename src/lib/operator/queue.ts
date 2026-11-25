// Ops queue rules on top of the fulfilment queue: setup SLA buckets, status filter, the 48 h "still setting up" alert and its dedupe key.
// Pure: no I/O. Tested by scripts/check-operator.mts.
import { isWaiting, ts, type QueueRow } from "@/lib/fulfilment/core";
import { APP_LABELS, type AppStatus } from "@/lib/app/domain";

export const SETUP_ALERT_HOURS = 48;
export type SlaBucket = "under24" | "h24" | "h48" | "h72";
export const BUCKET_LABELS: Record<SlaBucket, string> = { under24: "Under 24 h", h24: "24 to 48 h", h48: "48 to 72 h", h72: "Over 72 h" };

/** Over 72 h is red (we promise 72 h), 48 to 72 h is the alert zone, 24 to 48 h is amber. */
export function slaBucket(hours: number): SlaBucket {
  return hours > 72 ? "h72" : hours >= 48 ? "h48" : hours >= 24 ? "h24" : "under24";
}

/** Setting-up apps of a client that count for the setup SLA: not paused by the client, not on report hold. */
export function settingUpApps(row: Pick<QueueRow, "apps" | "hold">) {
  if (row.hold) return [];
  return row.apps.filter((a) => !a.userPaused && (a.status === "setting_up" || a.status === "awaiting_login"));
}

export type OpsStatus = "setting_up" | "needs_client_action" | "active" | "paused" | "closed";
export const OPS_STATUSES: readonly OpsStatus[] = ["setting_up", "needs_client_action", "active", "paused", "closed"];

/** The status an operator sees for one app: a report hold and the client's own pause win; live reads as active. */
export function opsStatusOf(a: { status: AppStatus; userPaused: boolean }, hold: QueueRow["hold"]): OpsStatus {
  if (hold === "closed") return "closed";
  if (hold || a.userPaused) return "paused";
  if (a.status === "live") return "active";
  if (a.status === "awaiting_login") return "setting_up";
  return a.status;
}

export type OpsFilters = { app: string | null; status: OpsStatus | null; minHours: 24 | 48 | 72 | null; internal: boolean };
export function parseOpsFilters(search: { app?: string; status?: string; min?: string; internal?: string }): OpsFilters {
  const min = Number(search.min);
  return {
    app: ["tinder", "hinge", "bumble"].includes(search.app ?? "") ? (search.app as string) : null,
    status: (OPS_STATUSES as readonly string[]).includes(search.status ?? "") ? (search.status as OpsStatus) : null,
    minHours: min === 24 || min === 48 || min === 72 ? min : null,
    internal: search.internal === "1"
  };
}

export function applyOpsFilters(rows: QueueRow[], f: OpsFilters): QueueRow[] {
  return rows.filter((r) => {
    if (!f.internal && r.internal) return false;
    const apps = r.apps.filter((a) => (f.app ? a.app === f.app : true));
    if (f.app && !apps.length) return false;
    if (f.status && !apps.some((a) => opsStatusOf(a, r.hold) === f.status)) return false;
    if (f.minHours && !(r.paid && isWaiting(r) && r.hoursWaiting >= f.minHours)) return false;
    return true;
  });
}

/** Counts shown above the queue. Internal accounts are never counted, even when listed. Only paid, waiting clients are on the SLA clock. */
export function queueCounts(rows: QueueRow[]) {
  const real = rows.filter((r) => !r.internal);
  const waiting = real.filter((r) => r.paid && isWaiting(r));
  const apps = real.flatMap((r) => r.apps.map((a) => opsStatusOf(a, r.hold)));
  return {
    waiting: waiting.length,
    over24: waiting.filter((r) => r.hoursWaiting >= 24).length,
    over48: waiting.filter((r) => r.hoursWaiting >= 48).length,
    over72: waiting.filter((r) => r.hoursWaiting > 72).length,
    settingUp: apps.filter((s) => s === "setting_up").length,
    needsYou: apps.filter((s) => s === "needs_client_action").length,
    active: apps.filter((s) => s === "active").length
  };
}

/** SLA order: paid clients still setting up first, longest wait first; then everyone else by wait; report holds, then internal, last. */
export function compareSla(a: QueueRow, b: QueueRow): number {
  const rank = (r: QueueRow) => (r.internal ? 3 : r.hold ? 2 : r.paid && isWaiting(r) ? 0 : 1);
  const diff = rank(a) - rank(b);
  if (diff) return diff;
  return (ts(a.waitingSince) || 0) - (ts(b.waitingSince) || 0);
}

/**
 * A paid, real client with an app still "setting up" 48 h or more after activation (the later of onboarding and payment). Unlike the
 * 24 h untouched alert it fires even when a status was touched: a half-finished setup is exactly what this is for.
 */
export function needsSetupAlert(row: QueueRow): boolean {
  if (row.internal || !row.paid) return false;
  return settingUpApps(row).length > 0 && row.hoursWaiting >= SETUP_ALERT_HOURS;
}

/** One alert per client per 48 h window since activation (48-95 h, then 96-143 h, ...). Stable across runs, so a retry never repeats it. */
export function setupAlertKey(userId: string, hoursWaiting: number): string {
  return `setup48:${userId}:${Math.floor(hoursWaiting / SETUP_ALERT_HOURS)}`;
}

/** No name, no email: hours, app names and the admin link. */
export function setupAlertLine(row: Pick<QueueRow, "hoursWaiting" | "apps" | "hold">, link: string): string {
  const names = settingUpApps(row).map((a) => APP_LABELS[a.app]).join(", ");
  return `Paid client still setting up after ${row.hoursWaiting} h (${names}). Finish the checklist: ${link}`;
}
