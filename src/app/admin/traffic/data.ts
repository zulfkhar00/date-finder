import "server-only";
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
  nowMs: number;
};

export async function getTrafficPage(range: RangeKey): Promise<TrafficPageData> {
  const nowMs = Date.now();
  const since = range === "all" ? null : nowMs - 2 * RANGE_MS[range];
  let rows;
  try {
    rows = await loadTrafficRows(since);
  } catch {
    throw new AdminDataError("traffic", undefined);
  }
  const model = buildTrafficModel(rows.events, rows.reservations, rows.internalUserIds);
  let earliest: number | null = null;
  for (const s of model.sessions.values()) earliest = earliest === null ? s.firstAt : Math.min(earliest, s.firstAt);
  const w = rangeWindows(range, nowMs, earliest);
  return {
    range,
    current: periodStats(model, w.from, w.to),
    previous: w.prevFrom !== null && w.prevTo !== null ? periodStats(model, w.prevFrom, w.prevTo) : null,
    live: liveNow(model, nowMs),
    trafficColumns: rows.trafficColumns,
    captureSince: model.captureSince,
    hasCountry: [...model.sessions.values()].some((s) => s.country),
    nowMs
  };
}
