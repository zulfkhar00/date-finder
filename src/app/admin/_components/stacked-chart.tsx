import type { StackedSeries } from "@/lib/traffic-report";
import { HOUR } from "@/lib/traffic-report";
import { formatInt } from "../_lib/format";
import styles from "../admin.module.css";

const W = 960;
const H = 240;
const PAD = { top: 12, right: 12, bottom: 28, left: 40 };
// Landing palette (src/app/globals.css): coral, grape-3, lime, sky, lilac, then blush for "other".
const COLORS = ["#F0402C", "#7A6C93", "#B8E04A", "#7CC4F0", "#C9B6F2", "#F5D3C8"];
const GRID = "rgba(34,16,74,.14)";
const LABEL = "#7A6C93";

function axisTop(max: number): number {
  const raw = Math.max(max, 1) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return Math.max(1, Math.ceil(step)) * 4;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC", hour12: false });

/** Visitors per bucket stacked by the top channels. Server-rendered SVG; scales to the card width. */
export function StackedChart({ series }: { series: StackedSeries }) {
  const { buckets, bucketMs, channels, values } = series;
  if (buckets.length === 0 || channels.length === 0) return <div className={styles.empty}>No visitors in this range yet.</div>;
  const totals = buckets.map((_, b) => values.reduce((sum, v) => sum + v[b], 0));
  const top = axisTop(Math.max(...totals));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / buckets.length;
  const barW = Math.max(1, slot * 0.72);
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const label = (t: number) => (bucketMs === HOUR ? `${hourFmt.format(new Date(t))}` : dayFmt.format(new Date(t)));

  return (
    <div>
      <div className={styles.legend}>
        {channels.map((name, i) => (
          <span key={name}><span className={styles.legendSwatch} style={{ background: COLORS[i % COLORS.length] }} />{name}</span>
        ))}
      </div>
      <div className={styles.chartScroll}>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Visitors per period stacked by channel">
        {[0, 1, 2, 3, 4].map((t) => {
          const y = PAD.top + innerH - (t / 4) * innerH;
          return (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} />
              <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="12" fill={LABEL}>{formatInt((top * t) / 4)}</text>
            </g>
          );
        })}
        {buckets.map((t, b) => {
          let y = PAD.top + innerH;
          const x = PAD.left + b * slot + (slot - barW) / 2;
          return (
            <g key={t}>
              {values.map((v, i) => {
                const h = (v[b] / top) * innerH;
                y -= h;
                return h > 0 ? <rect key={channels[i]} x={x} y={y} width={barW} height={h} fill={COLORS[i % COLORS.length]} /> : null;
              })}
              <rect x={PAD.left + b * slot} y={PAD.top} width={slot} height={innerH} fill="transparent">
                <title>{`${label(t)}: ${formatInt(totals[b])} visitors${values.map((v, i) => (v[b] ? `, ${channels[i]} ${v[b]}` : "")).join("")}`}</title>
              </rect>
              {(buckets.length - 1 - b) % labelEvery === 0 ? (
                <text x={PAD.left + b * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize="12" fill={LABEL}>{label(t)}</text>
              ) : null}
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}
