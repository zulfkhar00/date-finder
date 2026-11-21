import Link from "next/link";
import { DIRECT_CHANNEL, NOT_CAPTURED_CHANNEL, conversion, type DimRow, type PeriodStats, type RangeKey } from "@/lib/traffic-report";
import { formatInt } from "../_lib/format";
import type { SourceWindow } from "./data";
import styles from "../admin.module.css";

const WINDOWS: Record<SourceWindow, string> = { "7d": "7 days", "30d": "30 days" };

export type SourcesData = { window: SourceWindow; stats: PeriodStats; inAppColumn: boolean; hasFirstTouch: boolean };

/** Share with one decimal under 10 %, none above; "—" with nothing to divide. */
function pct(numerator: number, denominator: number): string {
  const c = conversion(numerator, denominator);
  if (c === null) return "—";
  const v = c * 100;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)}%`;
}

function StepCell({ n, of }: { n: number; of: number }) {
  return (
    <td className={styles.num}>
      {formatInt(n)}
      <span className={styles.pct}>{pct(n, of)}</span>
    </td>
  );
}

/** visitors → get_started → onboarding_complete → checkout_created → paid, each % is the step before it. */
function StepTable({ dimension, rows, limit = 10 }: { dimension: string; rows: DimRow[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  if (shown.length === 0) return <div className={styles.empty}>No visitors in this window yet.</div>;
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${styles.stepTable}`}>
        <thead>
          <tr>
            <th>{dimension}</th>
            <th className={styles.num}>Visitors</th>
            <th className={styles.num}>Get started</th>
            <th className={styles.num}>Onboarded</th>
            <th className={styles.num}>Checkout</th>
            <th className={styles.num}>Paid</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td className={styles.cellKey}>{r.key}</td>
              <td className={styles.num}>{formatInt(r.visitors)}</td>
              <StepCell n={r.getStarted} of={r.visitors} />
              <StepCell n={r.done} of={r.getStarted} />
              <StepCell n={r.checkouts} of={r.done} />
              <StepCell n={r.paid} of={r.checkouts} />
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length ? <p className={styles.sub}>+ {rows.length - shown.length} more not shown.</p> : null}
    </div>
  );
}

export function SourcesSection({ data, range, includeSuspect = false }: { data: SourcesData; range: RangeKey; includeSuspect?: boolean }) {
  const { stats: c, window } = data;
  const href = (w: SourceWindow) => {
    const q = new URLSearchParams();
    if (range !== "7d") q.set("range", range);
    if (w !== "30d") q.set("sources", w);
    if (includeSuspect) q.set("suspect", "1");
    const qs = q.toString();
    return `/admin/traffic${qs ? `?${qs}` : ""}#sources`;
  };

  const direct = c.channels.find((r) => r.key === DIRECT_CHANNEL);
  const notCaptured = c.channels.find((r) => r.key === NOT_CAPTURED_CHANNEL);
  const captured = c.totals.visitors - (notCaptured?.visitors ?? 0);
  const directVisitors = direct?.visitors ?? 0;

  // Checkout and paid rows for "(not linked to a visit)" are real reservations with no matching session; they are
  // useful in the totals but are not a source, so the tables show them last like every other row.
  return (
    <section id="sources" className={styles.card} aria-labelledby="sources-title">
      <div className={styles.cardHead}>
        <h2 id="sources-title">Where people come from</h2>
        <nav className={styles.segmented} aria-label="Sources window">
          {(Object.keys(WINDOWS) as SourceWindow[]).map((w) => (
            <Link key={w} href={href(w)} scroll={false} className={`${styles.segment} ${w === window ? styles.segmentActive : ""}`} aria-current={w === window ? "page" : undefined}>
              {WINDOWS[w]}
            </Link>
          ))}
        </nav>
      </div>
      <p className={styles.sub}>
        Real visitors only (founders, test emails, Stripe test checkouts, probe sessions and crawlers are excluded). Source = utm_source, else the referring site, else the in-app browser (Instagram, TikTok…), else direct.
        Each small % is the share of the step before it.
      </p>

      <div className={styles.statRow}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Visitors ({WINDOWS[window]})</div>
          <div className={styles.statValue}>{formatInt(c.totals.visitors)}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>Direct share</div>
          <div className={styles.statValue}>{pct(directVisitors, captured)}</div>
          <span className={styles.pct}>{formatInt(directVisitors)} of {formatInt(captured)} with a recorded source</span>
        </div>
        {notCaptured && notCaptured.visitors > 0 ? (
          <div className={styles.stat}>
            <div className={styles.statLabel}>Before tracking</div>
            <div className={styles.statValue}>{formatInt(notCaptured.visitors)}</div>
            <span className={styles.pct}>no source recorded, left out of the share</span>
          </div>
        ) : null}
      </div>
      <p className={`${styles.sub} ${styles.noteTight}`}>
        &quot;Direct&quot; means no UTM tag, no referrer and no recognised in-app browser. It is not people typing noswipe.app: it also holds links opened from messengers and email apps, privacy browsers that strip referrers, and untagged posts. Tag every link you post (Links tab) to shrink it.
        {data.inAppColumn ? "" : " In-app browser detection is not recording yet: apply supabase/2026-11-21-first-touch.sql, then Instagram/TikTok opens stop landing in direct."}
      </p>

      <h3 className={styles.subHead}>By source</h3>
      <StepTable dimension="Source" rows={c.channels} limit={12} />

      <h3 className={styles.subHead}>By landing page</h3>
      <StepTable dimension="Page" rows={c.landing} />

      <div className={styles.grid2}>
        <div>
          <h3 className={styles.subHead}>Top referrer sites</h3>
          {c.referrerHosts.length === 0 ? (
            <div className={styles.empty}>No external referrers yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>Host</th><th className={styles.num}>Visitors</th></tr></thead>
                <tbody>
                  {c.referrerHosts.slice(0, 10).map((r) => (
                    <tr key={r.key}><td className={styles.cellKey}>{r.key}</td><td className={styles.num}>{formatInt(r.visitors)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div>
          <h3 className={styles.subHead}>Countries</h3>
          <StepTable dimension="Country" rows={c.countries} limit={8} />
        </div>
      </div>

      {data.hasFirstTouch ? (
        <>
          <h3 className={styles.subHead}>Checkouts and paid by first touch</h3>
          <p className={`${styles.sub} ${styles.noteTight}`}>The source that first brought the browser (90-day cookie), stored on the reservation. Credits the channel that started the journey, not the last link clicked.</p>
          {c.firstTouch.length === 0 ? (
            <div className={styles.empty}>No reservation with a first touch in this window yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>First touch</th><th className={styles.num}>Checkouts</th><th className={styles.num}>Paid</th></tr></thead>
                <tbody>
                  {c.firstTouch.slice(0, 10).map((r) => (
                    <tr key={r.key}><td className={styles.cellKey}>{r.key}</td><td className={styles.num}>{formatInt(r.checkouts)}</td><td className={styles.num}>{formatInt(r.paid)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
