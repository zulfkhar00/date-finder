import type { ContentPost } from "@/lib/content";
import { postsPerDay, shortcodeFromUrl } from "@/lib/traffic-report";
import { formatInt } from "../_lib/format";
import type { InstagramVisits } from "./data";
import styles from "../admin.module.css";

const PT = "America/Los_Angeles";
const slotFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: PT });

const num = (v: number | null | undefined) => (typeof v === "number" ? v : null);
const hasMetrics = (p: ContentPost) => p.metrics_at != null || num(p.views) !== null;
const sum = (posts: ContentPost[], key: "views" | "likes" | "comments" | "shares" | "reach" | "saves") => posts.reduce((t, p) => t + (num(p[key]) ?? 0), 0);

export const METRIC_LABELS = [
  ["views", "Views"],
  ["likes", "Likes"],
  ["comments", "Comments"],
  ["shares", "Shares"],
  ["saves", "Saves"],
  ["reach", "Reach"]
] as const;

/** Per-video numbers on a card. */
export function PostMetrics({ post, visits }: { post: ContentPost; visits?: number }) {
  if (!hasMetrics(post)) return <p className={styles.sub}>No performance numbers yet.{visits ? ` ${visits} site visits.` : ""}</p>;
  return (
    <div>
      <ul className={styles.metricRow}>
        {METRIC_LABELS.map(([key, label]) =>
          num(post[key]) === null ? null : (
            <li key={key}><strong>{formatInt(post[key] as number)}</strong> <span className={styles.muted}>{label.toLowerCase()}</span></li>
          )
        )}
        {visits ? <li><strong>{formatInt(visits)}</strong> <span className={styles.muted}>site visits</span></li> : null}
      </ul>
    </div>
  );
}

/** Totals, average and the five best videos. Only posts with numbers count. */
export function PostedStats({ posts, metricsAvailable, byShortcode }: { posts: ContentPost[]; metricsAvailable: boolean; byShortcode: Map<string, number> }) {
  if (!metricsAvailable) {
    return <div className={styles.notice}>Performance columns are not in the database yet. Apply <code>supabase/2026-11-03-traffic.sql</code>, then have the posting-queue sync send <code>views, likes, comments, shares, reach, saves</code>.</div>;
  }
  const measured = posts.filter(hasMetrics);
  const withViews = measured.filter((p) => num(p.views) !== null);
  const avg = withViews.length ? Math.round(sum(withViews, "views") / withViews.length) : null;
  const top = [...withViews].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 5);
  const latest = measured.reduce<string | null>((m, p) => (p.metrics_at && (!m || p.metrics_at > m) ? p.metrics_at : m), null);
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>Performance</h2>
        <span className={styles.muted}>{measured.length} of {posts.length} posted videos have numbers{latest ? ` · updated ${slotFmt.format(new Date(latest))} PT` : ""}</span>
      </div>
      {measured.length === 0 ? (
        <div className={styles.empty}>The sync has not sent any performance numbers yet.</div>
      ) : (
        <>
          <div className={styles.miniKpis}>
            {METRIC_LABELS.map(([key, label]) => (
              <div key={key} className={styles.miniKpi}><div className={styles.kpiLabel}>{label}</div><div className={styles.miniKpiValue}>{formatInt(sum(measured, key))}</div></div>
            ))}
            <div className={styles.miniKpi}><div className={styles.kpiLabel}>Avg views / video</div><div className={styles.miniKpiValue}>{avg === null ? "—" : formatInt(avg)}</div></div>
          </div>
          <h3 className={styles.subhead}>Top 5 by views</h3>
          <ol className={styles.topList}>
            {top.map((p) => {
              const code = shortcodeFromUrl(p.post_url);
              const visits = code ? byShortcode.get(code) : undefined;
              return (
                <li key={p.id}>
                  <span className={styles.topTitle}>{p.post_url ? <a className={styles.rowLink} href={p.post_url} target="_blank" rel="noopener noreferrer">{clean(p.title)}</a> : clean(p.title)}</span>
                  <span className={styles.topNum}>{formatInt(p.views ?? 0)} views{visits ? ` · ${visits} visits` : ""}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}

function clean(title: string): string {
  return title.replace(/^[\s—–-]+/, "") || "Untitled";
}

/** Posts per day (14 d), IG-attributed site visits per day next to it, and the next scheduled slots. */
export function Cadence({ posts, instagram, nowMs }: { posts: ContentPost[]; instagram: InstagramVisits | null; nowMs: number }) {
  const perDay = postsPerDay(posts.filter((p) => p.status === "posted").map((p) => p.posted_at ?? p.scheduled_at), nowMs, 14, PT);
  const maxPosts = Math.max(1, ...perDay.map((d) => d.count));
  const visitsByDay = new Map((instagram?.perDay ?? []).map((d) => [d.day, d.count]));
  const maxVisits = Math.max(1, ...(instagram?.perDay ?? []).map((d) => d.count));
  const next = posts
    .filter((p) => p.status === "scheduled" && p.scheduled_at && Date.parse(p.scheduled_at) >= nowMs)
    .sort((a, b) => Date.parse(a.scheduled_at!) - Date.parse(b.scheduled_at!))
    .slice(0, 6);
  const total14 = perDay.reduce((t, d) => t + d.count, 0);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>Posting cadence</h2>
        <span className={styles.muted}>{total14} posted in 14 days · {(total14 / 14).toFixed(1)}/day{instagram ? ` · ${formatInt(instagram.total)} Instagram visits` : ""}</span>
      </div>
      <div className={styles.legend}>
        <span><span className={styles.legendSwatch} style={{ background: "#F0402C" }} />Posts per day</span>
        {instagram ? <span><span className={styles.legendSwatch} style={{ background: "#7CC4F0" }} />Site visits from Instagram</span> : null}
      </div>
      <div className={styles.cadence} role="img" aria-label="Posts per day and Instagram site visits, last 14 days">
        {perDay.map((d) => {
          const visits = visitsByDay.get(d.day) ?? 0;
          return (
            <div key={d.day} className={styles.cadenceDay} title={`${d.day}: ${d.count} posted${instagram ? `, ${visits} Instagram visits` : ""}`}>
              <div className={styles.cadenceBars}>
                <div className={styles.cadenceBar} style={{ height: `${(d.count / maxPosts) * 100}%`, background: "#F0402C" }} />
                {instagram ? <div className={styles.cadenceBar} style={{ height: `${(visits / maxVisits) * 100}%`, background: "#7CC4F0" }} /> : null}
              </div>
              <div className={styles.cadenceNum}>{d.count}</div>
              <div className={styles.cadenceLabel}>{Number(d.day.slice(8, 10))}</div>
            </div>
          );
        })}
      </div>
      <h3 className={styles.subhead}>Next scheduled slots (PT)</h3>
      {next.length === 0 ? (
        <p className={styles.sub}>Nothing scheduled. The queue is empty.</p>
      ) : (
        <ul className={styles.slotList}>
          {next.map((p) => (
            <li key={p.id}><span className={styles.nowrap}>{slotFmt.format(new Date(p.scheduled_at!))}</span> <span className={styles.muted}>{clean(p.title)}</span></li>
          ))}
        </ul>
      )}
    </section>
  );
}
