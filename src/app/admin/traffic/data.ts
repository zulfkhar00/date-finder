import "server-only";
import { describeFiltered, summariseFiltered } from "@/lib/bot-quality";
import { heroExperiment, type HeroRow } from "@/lib/hero-report";
import { buildTrafficModel, liveNow, periodStats, rangeWindows, RANGE_MS, type LiveNow, type PeriodStats, type RangeKey } from "@/lib/traffic-report";
import { AdminDataError } from "../_lib/data";
import { loadTrafficRows } from "../_lib/traffic-data";

export type TrafficPageData = {
  range: RangeKey;
  current: PeriodStats;
  previous: PeriodStats | null;
  live: LiveNow;
  /** false until supabase/2026-11-03-traffic.sql is applied. */
  trafficColumns: boolean;
  /** First moment source/landing/device data exists; null if none yet. */
  captureSince: number | null;
  hasCountry: boolean;
  /** "Where people come from": its own 7 d / 30 d window, independent of the page range. */
  sources: { window: SourceWindow; stats: PeriodStats; inAppColumn: boolean; hasFirstTouch: boolean };
  nowMs: number;
  /** Whether suspect sessions are counted (?suspect=1). Bots never are. */
  includeSuspect: boolean;
  /** "N sessions left out (why)" for the current range; null when nothing was filtered. */
  filteredNote: string | null;
  /** How many suspect sessions the toggle would add back in this range (0 when they are already in). */
  suspectInRange: number;
  /** false until supabase/2026-11-22-session-quality.sql is applied. */
  qualityColumn: boolean;
  /** Home hero A/B test over the selected range: all / desktop / mobile. */
  hero: HeroRow[];
};

export type SourceWindow = "7d" | "30d";

export async function getTrafficPage(range: RangeKey, sourceWindow: SourceWindow = "30d", includeSuspect = false): Promise<TrafficPageData> {
  const nowMs = Date.now();
  // The sources section always needs a full 30 days, whatever the page range is.
  const since = range === "all" ? null : nowMs - Math.max(2 * RANGE_MS[range], RANGE_MS["30d"]);
  let rows;
  try {
    rows = await loadTrafficRows(since);
  } catch {
    throw new AdminDataError("traffic", undefined);
  }
  const model = buildTrafficModel(rows.events, rows.reservations, rows.firstTouchByStripe, { includeSuspect, nowMs, internalUserIds: rows.internalUserIds });
  let earliest: number | null = null;
  for (const s of model.sessions.values()) earliest = earliest === null ? s.firstAt : Math.min(earliest, s.firstAt);
  const w = rangeWindows(range, nowMs, earliest);
  const inRange = (at: number) => at >= w.from && at < w.to;
  const filtered = summariseFiltered(model.qualities, { includeSuspect }, inRange);
  return {
    range,
    current: periodStats(model, w.from, w.to),
    previous: w.prevFrom !== null && w.prevTo !== null ? periodStats(model, w.prevFrom, w.prevTo) : null,
    live: liveNow(model, nowMs),
    trafficColumns: rows.trafficColumns,
    captureSince: model.captureSince,
    hasCountry: [...model.sessions.values()].some((s) => s.country),
    sources: { window: sourceWindow, stats: periodStats(model, nowMs - RANGE_MS[sourceWindow], nowMs + 1), inAppColumn: rows.inAppColumn, hasFirstTouch: rows.firstTouchByStripe.size > 0 },
    nowMs,
    includeSuspect,
    filteredNote: describeFiltered(filtered),
    suspectInRange: includeSuspect ? 0 : filtered.suspect,
    qualityColumn: rows.qualityColumn,
    hero: heroExperiment(model, w.from, w.to)
  };
}
