// Pure rules for the account activity feed the phone rig writes and the client reads on Home. No I/O and no server-only
// imports, so scripts/check-activity.ts runs it directly. Nothing here ever holds message text, names or credentials.
import { z } from "zod";
import { APPS, type App } from "@/lib/app/domain";

export const ACTIVITY_KINDS = ["swipes", "match", "chat", "date_booked", "needs_you"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export type ActivityRow = { app: App; kind: ActivityKind; count: number; match_ref: string | null; occurred_at: string };

const iso = z.string().datetime({ offset: true });
const key = z.string().trim().min(8).max(200);

/** One event as the rig POSTs it. `idempotencyKey` is the rig's own id for the event: replaying it is a no-op. */
export const eventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("swipes"), app: z.enum(APPS), idempotencyKey: key, occurredAt: iso.optional(), count: z.number().int().min(1).max(10000) }),
  z.object({ kind: z.literal("match"), app: z.enum(APPS), idempotencyKey: key, occurredAt: iso.optional(), matchRef: z.string().trim().min(1).max(200).optional() }),
  z.object({ kind: z.literal("chat"), app: z.enum(APPS), idempotencyKey: key, occurredAt: iso.optional(), matchRef: z.string().trim().min(1).max(200) }),
  z.object({
    kind: z.literal("date_booked"), app: z.enum(APPS), idempotencyKey: key, occurredAt: iso.optional(),
    matchRef: z.string().trim().min(1).max(200).optional(),
    who: z.string().trim().min(1).max(80), venue: z.string().trim().min(1).max(160), address: z.string().trim().max(240).nullable().optional(),
    startsAt: iso, summary: z.string().trim().max(600).nullable().optional()
  }),
  z.object({ kind: z.literal("needs_you"), app: z.enum(APPS), idempotencyKey: key, occurredAt: iso.optional(), reason: z.string().trim().min(3).max(200) })
]);
export type ActivityEvent = z.infer<typeof eventSchema>;

/** A batch is 1 to 200 events from one client. */
export const batchSchema = z.object({ events: z.array(z.unknown()).min(1).max(200) });
export const MAX_FUTURE_MS = 5 * 60_000;
export const MAX_AGE_MS = 7 * 86_400_000;

/** Events dated well in the future or more than a week in the past are the rig's clock being wrong: refuse, never store. */
export function occurredAtOk(occurredAt: string | undefined, nowMs: number): boolean {
  if (!occurredAt) return true;
  const t = Date.parse(occurredAt);
  return Number.isFinite(t) && t <= nowMs + MAX_FUTURE_MS && t >= nowMs - MAX_AGE_MS;
}

// --- what Home shows ----------------------------------------------------------------------------------------------------

export type DayStats = { swipes: number; matches: number; chatsActive: number; datesBooked: number; lastAt: string | null; events: number };
export const EMPTY_STATS: DayStats = { swipes: 0, matches: 0, chatsActive: 0, datesBooked: 0, lastAt: null, events: 0 };

/** The calendar day (YYYY-MM-DD) of an instant in a time zone. An unknown zone falls back to UTC. */
export function dayKey(ms: number, timeZone?: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * Today's numbers per app, where "today" is the viewer's own calendar day. "Chats active" is the number of different
 * chats the rig worked on today, not the number of messages.
 */
export function summarizeToday(rows: readonly ActivityRow[], nowMs: number, timeZone?: string): Record<App, DayStats> {
  const today = dayKey(nowMs, timeZone);
  const out = Object.fromEntries(APPS.map((a) => [a, { ...EMPTY_STATS }])) as Record<App, DayStats>;
  const chats = new Map<App, Set<string>>();
  for (const r of rows) {
    const t = Date.parse(r.occurred_at);
    if (!Number.isFinite(t) || dayKey(t, timeZone) !== today || !out[r.app]) continue;
    const s = out[r.app];
    s.events += 1;
    if (!s.lastAt || t > Date.parse(s.lastAt)) s.lastAt = r.occurred_at;
    if (r.kind === "swipes") s.swipes += r.count;
    else if (r.kind === "match") s.matches += r.count;
    else if (r.kind === "date_booked") s.datesBooked += r.count;
    else if (r.kind === "chat") {
      const set = chats.get(r.app) ?? new Set<string>();
      set.add(r.match_ref ?? r.occurred_at);
      chats.set(r.app, set);
      s.chatsActive = set.size;
    }
  }
  return out;
}

/** Last activity as a sentence for the card; null when the rig has not reported anything. */
export function hasActivity(stats: DayStats): boolean {
  return stats.events > 0;
}
