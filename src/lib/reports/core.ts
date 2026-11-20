// Pure rules for the takedown process: categories, validation, SLA maths, grouping, rate limits.
// No I/O and no server-only imports, so `npm test` (scripts/check-reports.ts) runs it directly.

export const CATEGORIES = ["minor_safety", "trafficking", "non_consensual_images", "threats", "harassment", "scam_fraud", "impersonation", "other"] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  minor_safety: "Minor safety (someone under 18)",
  trafficking: "Trafficking or exploitation",
  non_consensual_images: "Non-consensual intimate images",
  threats: "Threats of violence",
  harassment: "Harassment",
  scam_fraud: "Scam or fraud",
  impersonation: "Impersonation",
  other: "Something else"
};
/** Handled first, with a 4 hour target. */
export const URGENT_CATEGORIES: readonly Category[] = ["minor_safety", "trafficking", "non_consensual_images", "threats"];

export const SUBJECT_KINDS = ["profile", "message", "photo", "other"] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];
export const SUBJECT_LABELS: Record<SubjectKind, string> = { profile: "A profile on a dating app", message: "A message", photo: "A photo", other: "Something else" };

export const DATING_APPS = ["tinder", "hinge", "bumble", "badoo", "other"] as const;
export type DatingApp = (typeof DATING_APPS)[number];
export const DATING_APP_LABELS: Record<DatingApp, string> = { tinder: "Tinder", hinge: "Hinge", bumble: "Bumble", badoo: "Badoo", other: "Another app" };

export const STATUSES = ["new", "acknowledged", "investigating", "actioned", "dismissed", "appealed"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { new: "New", acknowledged: "Acknowledged", investigating: "Investigating", actioned: "Actioned", dismissed: "Dismissed", appealed: "Appealed" };
export const OPEN_STATUSES: readonly Status[] = ["new", "acknowledged", "investigating", "appealed"];

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
export const ACK_MS = 24 * HOUR;
export const RESOLVE_MS = 72 * HOUR;
export const URGENT_MS = 4 * HOUR;
export const APPEAL_WINDOW_MS = 14 * DAY;
export const APPEAL_SLA_MS = 7 * DAY;

export const LIMITS = { description: 4000, profileRef: 300, email: 254, note: 2000, appeal: 2000, appealMin: 10, upload: 4 * 1024 * 1024 } as const;
export const RATE = { perIpHour: 3, perIpDay: 10, globalHour: 60, opsLinesPerHour: 10 } as const;

export function isCategory(v: unknown): v is Category { return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v); }
export function isUrgentCategory(c: Category): boolean { return URGENT_CATEGORIES.includes(c); }
/** Urgent = an urgent category, or the reporter said someone is in danger. */
export function isUrgent(category: Category, inDanger: boolean): boolean { return inDanger || isUrgentCategory(category); }

/** Strips control characters (keeps newline and tab), normalises line endings, trims. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, max);
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
export function parseEmail(value: unknown): { ok: true; email: string | null } | { ok: false } {
  const raw = cleanText(value, 400).toLowerCase();
  if (!raw) return { ok: true, email: null };
  if (raw.length > LIMITS.email || !EMAIL.test(raw)) return { ok: false };
  return { ok: true, email: raw };
}

export type ReportInput = {
  email: string | null; subjectKind: SubjectKind; datingApp: DatingApp | null; profileRef: string | null;
  description: string; category: Category; inDanger: boolean; honeypot: boolean;
};
export type FieldErrors = Partial<Record<"email" | "subjectKind" | "datingApp" | "description" | "category", string>>;

/** Validates the public form. The honeypot is reported, not rejected: the caller fakes a success. */
export function parseReportForm(get: (name: string) => unknown): { ok: true; input: ReportInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const email = parseEmail(get("email"));
  if (!email.ok) errors.email = "That email address doesn't look right. Leave it empty to report anonymously.";
  const subjectKind = get("subjectKind");
  if (typeof subjectKind !== "string" || !(SUBJECT_KINDS as readonly string[]).includes(subjectKind)) errors.subjectKind = "Choose what you are reporting.";
  const category = get("category");
  if (!isCategory(category)) errors.category = "Choose a category.";
  const appRaw = cleanText(get("datingApp"), 20);
  if (appRaw && !(DATING_APPS as readonly string[]).includes(appRaw)) errors.datingApp = "Choose one of the listed apps.";
  const description = cleanText(get("description"), LIMITS.description + 1);
  if (!description) errors.description = "Tell us what happened.";
  else if (description.length > LIMITS.description) errors.description = `Keep it under ${LIMITS.description} characters. You can add more after we reply.`;
  if (Object.keys(errors).length || !email.ok || !isCategory(category)) return { ok: false, errors };
  return {
    ok: true,
    input: {
      email: email.email, subjectKind: subjectKind as SubjectKind, datingApp: (appRaw || null) as DatingApp | null,
      profileRef: cleanText(get("profileRef"), LIMITS.profileRef) || null, description, category,
      inDanger: get("inDanger") === "on" || get("inDanger") === "1" || get("inDanger") === "true",
      honeypot: cleanText(get("website"), 200) !== ""
    }
  };
}

/**
 * Key that groups reports about the same profile: app + a normalised name or link.
 * "https://Tinder.com/@Jane/?x=1" and "jane" group together; empty input has no key.
 */
export function groupKey(app: DatingApp | null, profileRef: string | null): string | null {
  if (!profileRef) return null;
  let ref = profileRef.toLowerCase().trim();
  ref = ref.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");
  const parts = ref.split("/");
  if (parts.length > 1 && /\.[a-z]{2,}$/.test(parts[0])) ref = parts[parts.length - 1] || parts[0];
  ref = ref.replace(/^@/, "").replace(/\s+/g, " ").trim();
  if (!ref) return null;
  return `${app ?? "any"}:${ref}`.slice(0, 200);
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** NS-XXXX-XXXX, no look-alike characters. */
function randomBelow(max: number): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] % max;
}
export function newReference(random: (max: number) => number = randomBelow): string {
  const pick = () => Array.from({ length: 4 }, () => REF_ALPHABET[random(REF_ALPHABET.length)]).join("");
  return `NS-${pick()}-${pick()}`;
}
export function normaliseReference(value: string): string { return value.trim().toUpperCase(); }

// ---------- uploads ----------
export function sniffImage(b: Uint8Array): { type: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { type: "image/webp", ext: "webp" };
  return null;
}
export type UploadCheck = { ok: true; type: string; ext: string } | { ok: false; error: string };
/** Size and real file type (by bytes, not by name or declared type). */
export function checkUpload(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, error: "That file is empty." };
  if (bytes.length > LIMITS.upload) return { ok: false, error: "The image is too large. Use one under 4 MB." };
  const kind = sniffImage(bytes);
  if (!kind) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  return { ok: true, ...kind };
}

// ---------- rate limits ----------
export type RateCounts = { ipLastHour: number; ipLastDay: number; allLastHour: number };
export type RateDecision = { ok: true; opsLine: "line" | "summary" | "none" } | { ok: false; reason: "ip" | "busy" };
/** Per address limits, a global flood guard, and how many ops lines this report may produce. */
export function decideRate(c: RateCounts): RateDecision {
  if (c.ipLastHour >= RATE.perIpHour || c.ipLastDay >= RATE.perIpDay) return { ok: false, reason: "ip" };
  if (c.allLastHour >= RATE.globalHour) return { ok: false, reason: "busy" };
  if (c.allLastHour < RATE.opsLinesPerHour) return { ok: true, opsLine: "line" };
  return { ok: true, opsLine: c.allLastHour === RATE.opsLinesPerHour ? "summary" : "none" };
}

// ---------- SLA ----------
export type SlaReport = {
  status: Status; urgent: boolean; created_at: string; ack_at: string | null; resolved_at: string | null; appealed_at: string | null;
};
export type Sla = {
  /** What the clock is waiting for, null when nothing is due. */
  kind: "acknowledge" | "resolve" | "appeal" | null;
  dueAt: Date | null;
  /** Milliseconds until due (negative = overdue). */
  remainingMs: number | null;
  overdue: boolean;
  /** Target for the first response (4 h urgent, else 24 h). */
  ackTargetMs: number;
};

/**
 * Acknowledge within 24 h (4 h urgent), resolve within 72 h of the report, appeals within 7 days of the appeal.
 * Times are instants (UTC); display is the caller's business.
 */
export function slaFor(r: SlaReport, now: Date): Sla {
  const ackTargetMs = r.urgent ? URGENT_MS : ACK_MS;
  const created = new Date(r.created_at).getTime();
  let kind: Sla["kind"] = null;
  let due: number | null = null;
  if (r.status === "new") { kind = "acknowledge"; due = created + ackTargetMs; }
  else if (r.status === "acknowledged" || r.status === "investigating") { kind = "resolve"; due = created + RESOLVE_MS; }
  else if (r.status === "appealed") { kind = "appeal"; due = (r.appealed_at ? new Date(r.appealed_at).getTime() : created) + APPEAL_SLA_MS; }
  if (due === null || Number.isNaN(due)) return { kind: null, dueAt: null, remainingMs: null, overdue: false, ackTargetMs };
  const remainingMs = due - now.getTime();
  return { kind, dueAt: new Date(due), remainingMs, overdue: remainingMs < 0, ackTargetMs };
}

/** "3h 10m left", "overdue 5h 2m", "2d 1h left". */
export function formatRemaining(ms: number): string {
  const over = ms < 0;
  const mins = Math.floor(Math.abs(ms) / 60_000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return over ? `overdue ${text}` : `${text} left`;
}
export function formatAge(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export type QueueRow = SlaReport & { id: string };
/** Open and urgent first; then overdue; then nearest deadline. Closed reports last, newest first. */
export function compareQueue(a: QueueRow, b: QueueRow, now: Date): number {
  const open = (r: QueueRow) => (OPEN_STATUSES as readonly string[]).includes(r.status);
  if (open(a) !== open(b)) return open(a) ? -1 : 1;
  if (!open(a)) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
  const sa = slaFor(a, now), sb = slaFor(b, now);
  if (sa.overdue !== sb.overdue) return sa.overdue ? -1 : 1;
  return (sa.remainingMs ?? Infinity) - (sb.remainingMs ?? Infinity);
}

// ---------- appeals ----------
export type Hold = "paused" | "closed";
export type AppealState =
  | { kind: "can_appeal"; deadline: Date }
  | { kind: "submitted" }
  | { kind: "decided"; outcome: "upheld" | "overturned" }
  | { kind: "expired"; deadline: Date };
/** Whether the held user may appeal: once, within 14 days of the decision. */
export function appealState(report: { status: Status; appeal_outcome: string | null; appealed_at: string | null }, holdAt: string | null, now: Date): AppealState {
  if (report.status === "appealed") return { kind: "submitted" };
  if (report.appeal_outcome === "upheld" || report.appeal_outcome === "overturned") return { kind: "decided", outcome: report.appeal_outcome };
  const deadline = new Date((holdAt ? new Date(holdAt).getTime() : 0) + APPEAL_WINDOW_MS);
  return now.getTime() <= deadline.getTime() ? { kind: "can_appeal", deadline } : { kind: "expired", deadline };
}

/** Same admin who made the original decision resolving the appeal: warn, never block. */
export function sameDeciderWarning(decidedBy: string | null, admin: string): boolean {
  return !!decidedBy && decidedBy.trim().toLowerCase() === admin.trim().toLowerCase();
}

export function parseNote(value: unknown): { ok: true; note: string } | { ok: false } {
  const note = cleanText(value, LIMITS.note);
  return note.length >= 3 ? { ok: true, note } : { ok: false };
}

/** Email-looking tokens in free text (for matching a report to a client). */
export function emailsIn(text: string): string[] {
  return [...new Set((text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.toLowerCase()))].slice(0, 5);
}

// ---------- admin actions ----------
export const ACTIONS = ["acknowledge", "investigate", "link_client", "unlink_client", "pause_client", "remove_photo", "close_account", "dismiss", "mark_actioned", "record_ncmec", "appeal_uphold", "appeal_overturn"] as const;
export type ActionName = (typeof ACTIONS)[number];
export const CLIENT_ACTIONS: readonly ActionName[] = ["pause_client", "remove_photo", "close_account"];

/** Which actions make sense for a report right now. The server enforces the same list. */
export function allowedActions(r: { status: Status; category: Category; matched: boolean }): ActionName[] {
  const out: ActionName[] = [];
  const add = (...a: ActionName[]) => out.push(...a);
  if (r.status === "appealed") add("appeal_uphold", "appeal_overturn");
  else if (r.status === "new") add("acknowledge", "investigate");
  else if (r.status === "acknowledged") add("investigate");
  if (r.status !== "appealed") {
    if (r.status !== "dismissed") add("link_client", "unlink_client");
    if (r.matched && r.status !== "dismissed") add("pause_client", "remove_photo", "close_account");
    if (r.status !== "actioned" && r.status !== "dismissed") add("mark_actioned", "dismiss");
  }
  if (r.category === "minor_safety") add("record_ncmec");
  return out;
}
export const ACTION_LABELS: Record<ActionName, string> = {
  acknowledge: "Acknowledge", investigate: "Start investigating", link_client: "Link to this client", unlink_client: "Unlink client",
  pause_client: "Pause client (stop all activity)", remove_photo: "Remove selected photo", close_account: "Close account (soft)",
  dismiss: "Dismiss", mark_actioned: "Mark actioned (no account step)", record_ncmec: "Record NCMEC filing",
  appeal_uphold: "Uphold the decision", appeal_overturn: "Overturn and restore"
};
export function isAction(v: unknown): v is ActionName { return typeof v === "string" && (ACTIONS as readonly string[]).includes(v); }

/** Plain ID typed by a person after filing at the CyberTipline. */
export function parseNcmecId(value: unknown): { ok: true; id: string } | { ok: false } {
  const id = cleanText(value, 60);
  return /^[A-Za-z0-9][A-Za-z0-9 _-]{2,59}$/.test(id) ? { ok: true, id } : { ok: false };
}

/** The one-line alert for ops. Never contains the description, the email or any name. */
export function opsLineNew(r: { ref: string; category: Category; urgent: boolean; datingApp: string | null; related: number }, link: string): string {
  return `${r.urgent ? "URGENT " : ""}New report ${r.ref}: ${CATEGORY_LABELS[r.category]}${r.datingApp ? ` (${r.datingApp})` : ""}${r.related > 0 ? `, #${r.related + 1} on the same profile` : ""}\n${link}`;
}
export function opsLineBreach(r: { ref: string; category: Category; urgent: boolean }, sla: Sla, link: string): string {
  const what = sla.kind === "acknowledge" ? "acknowledgement" : sla.kind === "appeal" ? "appeal review" : "resolution";
  return `${r.urgent ? "URGENT " : ""}SLA breach ${r.ref}: ${what} ${formatRemaining(sla.remainingMs ?? 0)} (${CATEGORY_LABELS[r.category]})\n${link}`;
}
