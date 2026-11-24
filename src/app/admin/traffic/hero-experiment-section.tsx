import { HERO_MIN_PER_ARM, type HeroArm, type HeroRow, type HeroSegment } from "@/lib/hero-report";
import { formatInt } from "../_lib/format";
import styles from "../admin.module.css";

const SEGMENT_LABEL: Record<HeroSegment, string> = { all: "All devices", desktop: "Desktop", mobile: "Mobile" };

function pct(n: number, of: number): string {
  if (of <= 0) return "—";
  const v = (n / of) * 100;
  return `${v >= 10 ? Math.round(v) : v.toFixed(1)}%`;
}

function Cell({ n, of }: { n: number; of: number }) {
  return <td className={styles.num}>{formatInt(n)}<span className={styles.pct}>{pct(n, of)}</span></td>;
}

function ArmRow({ label, segment, arm }: { label: string; segment: string; arm: HeroArm }) {
  return (
    <tr>
      <td className={styles.cellKey}>{segment}</td>
      <td className={styles.cellKey}>{label}</td>
      <td className={styles.num}>{formatInt(arm.sessions)}</td>
      <Cell n={arm.started} of={arm.sessions} />
      <Cell n={arm.basics} of={arm.started} />
      <Cell n={arm.done} of={arm.basics} />
      <Cell n={arm.checkouts} of={arm.done} />
      <Cell n={arm.paid} of={arm.checkouts} />
    </tr>
  );
}

function verdictText(row: HeroRow): string {
  const v = row.verdict;
  if (v.kind === "collecting") return `Collecting: ${formatInt(v.needed)} more sessions needed in the smaller arm before this can be called (minimum ${HERO_MIN_PER_ARM} per arm).`;
  if (v.kind === "winner") return `${v.winner.toUpperCase()} is ahead on onboarding starts (p = ${v.p.toFixed(3)}).`;
  return `No difference detected yet (p = ${v.p.toFixed(2)}).`;
}

/**
 * Home hero A/B test: A = "Skip the swipe. Make plans.", B = "We create your dating profiles and run them for you."
 * Sessions -> onboarding started -> basics done -> complete -> checkout -> paid, per variant and device. The
 * primary metric is sessions -> onboarding started; it is the only one that gets a significance call.
 */
export function HeroExperimentSection({ rows }: { rows: HeroRow[] }) {
  const empty = rows.every((r) => r.a.sessions + r.b.sessions === 0);
  return (
    <section id="hero-test" className={styles.card} aria-labelledby="hero-test-title">
      <div className={styles.cardHead}><h2 id="hero-test-title">Home hero test</h2></div>
      <p className={styles.sub}>
        A = current hero (&quot;Skip the swipe. Make plans.&quot;). B = &quot;We create your dating profiles and run them for you&quot;, one button, steps right under, a real app screen. 50/50 per browser, sticky for 30 days; only visits that landed on the home page count.
        Bots, suspect sessions, founders, test checkouts and QA previews (<code>/?v=a</code>, <code>/?v=b</code>) are excluded. Each small % is the share of the step before it.
      </p>
      {empty ? (
        <div className={styles.empty}>No test sessions in this range yet.</div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={`${styles.table} ${styles.stepTable}`}>
              <thead>
                <tr>
                  <th>Devices</th>
                  <th>Variant</th>
                  <th className={styles.num}>Sessions</th>
                  <th className={styles.num}>Onboarding started</th>
                  <th className={styles.num}>Basics done</th>
                  <th className={styles.num}>Complete</th>
                  <th className={styles.num}>Checkout</th>
                  <th className={styles.num}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <HeroSegmentRows key={row.segment} row={row} />
                ))}
              </tbody>
            </table>
          </div>
          <ul className={styles.sub}>
            {rows.map((row) => <li key={row.segment}><strong>{SEGMENT_LABEL[row.segment]}:</strong> {verdictText(row)}</li>)}
          </ul>
        </>
      )}
      <p className={`${styles.sub} ${styles.noteTight}`}>
        How to read it: do not call a winner before both arms of a row have {HERO_MIN_PER_ARM} sessions (at a ~17% baseline that is enough to see roughly 17% to 25%). The p-value is a two-sided two-proportion z-test on sessions to onboarding started, with 0.05 as the bar; device rows are looked at separately, so treat a single device win as a hint and the all-devices row as the call. Checkout and paid are far too rare to test: read them as direction only.
      </p>
    </section>
  );
}

function HeroSegmentRows({ row }: { row: HeroRow }) {
  return (
    <>
      <ArmRow segment={SEGMENT_LABEL[row.segment]} label="A (current)" arm={row.a} />
      <ArmRow segment="" label="B (new)" arm={row.b} />
    </>
  );
}
