import type { DailyPoint } from "../_lib/data";
import { formatDay, formatInt } from "../_lib/format";
import styles from "../admin.module.css";

const W = 960;
const H = 260;
const PAD = { top: 16, right: 44, bottom: 30, left: 48 };
// Landing palette: grape-3 for volume, coral for money (src/app/globals.css).
const VIEWS = "#7A6C93";
const PAID = "#F0402C";
const GRID = "rgba(34,16,74,.14)";
const LABEL = "#7A6C93";

/** Smallest 1/2/5×10^k step so 4 steps cover max, at least 1 (counts are integers). */
function axisTop(max: number): number {
  const raw = Math.max(max, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return Math.max(1, Math.ceil(step)) * 4;
}

/**
 * Dual-axis daily line chart rendered on the server as SVG (no client JS):
 * page views on the left axis, paid reservations on the right. Hover a day for exact values.
 */
export function DailyChart({ points }: { points: DailyPoint[] }) {
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const viewsTop = axisTop(Math.max(0, ...points.map((p) => p.pageViews)));
  const paidTop = axisTop(Math.max(0, ...points.map((p) => p.paid)));
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const x = (i: number) => PAD.left + i * step;
  const yViews = (v: number) => PAD.top + innerH - (v / viewsTop) * innerH;
  const yPaid = (v: number) => PAD.top + innerH - (v / paidTop) * innerH;
  const line = (y: (v: number) => number, key: "pageViews" | "paid") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const ticks = [0, 1, 2, 3, 4];
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));

  return (
    <div>
      <div className={styles.legend}>
        <span><span className={styles.legendSwatch} style={{ background: VIEWS }} />Page views (left axis)</span>
        <span><span className={styles.legendSwatch} style={{ background: PAID }} />Paid reservations (right axis)</span>
      </div>
      <div className={styles.chartScroll}>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Daily page views and paid reservations">
        {ticks.map((t) => {
          const y = PAD.top + innerH - (t / 4) * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill={LABEL}>{formatInt((viewsTop * t) / 4)}</text>
              <text x={W - PAD.right + 8} y={y + 4} fontSize="11" fill={PAID}>{formatInt((paidTop * t) / 4)}</text>
            </g>
          );
        })}
        {points.map((p, i) =>
          // Anchored on the newest day so labels stay evenly spaced and never collide at the edge.
          (points.length - 1 - i) % labelEvery === 0 ? (
            <text key={p.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill={LABEL}>{formatDay(p.day)}</text>
          ) : null
        )}
        <path d={line(yViews, "pageViews")} fill="none" stroke={VIEWS} strokeWidth="2" strokeLinejoin="round" />
        <path d={line(yPaid, "paid")} fill="none" stroke={PAID} strokeWidth="2.25" strokeLinejoin="round" />
        {points.map((p, i) => (p.paid > 0 ? <circle key={p.day} cx={x(i)} cy={yPaid(p.paid)} r="3" fill={PAID} /> : null))}
        {points.map((p, i) => (
          <rect key={`hit-${p.day}`} x={x(i) - step / 2} y={PAD.top} width={Math.max(step, 1)} height={innerH} fill="transparent">
            <title>{`${formatDay(p.day)}: ${formatInt(p.pageViews)} page views, ${formatInt(p.visitors)} visitors, ${formatInt(p.paid)} paid`}</title>
          </rect>
        ))}
      </svg>
      </div>
    </div>
  );
}
