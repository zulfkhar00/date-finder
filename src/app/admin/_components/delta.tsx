import { formatDelta, periodDelta } from "@/lib/traffic-report";
import styles from "../admin.module.css";

/**
 * Change against the previous period. `goodWhen` says which direction is good (more visitors: up).
 * Renders nothing when there is no previous period (all time).
 */
export function DeltaBadge({ current, previous, unit = "" }: { current: number; previous: number | null | undefined; unit?: string }) {
  const delta = periodDelta(current, previous);
  if (!delta) return null;
  const tone = delta.dir === "up" || delta.dir === "new" ? styles.deltaUp : delta.dir === "down" ? styles.deltaDown : styles.deltaFlat;
  const arrow = delta.dir === "up" || delta.dir === "new" ? "▲" : delta.dir === "down" ? "▼" : "•";
  return (
    <span className={`${styles.delta} ${tone}`} title="vs the previous period of the same length">
      <span aria-hidden>{arrow}</span> {formatDelta(delta, unit)}
    </span>
  );
}
