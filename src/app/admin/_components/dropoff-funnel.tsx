import type { Totals } from "@/lib/traffic-report";
import { formatInt, percent } from "../_lib/format";
import styles from "../admin.module.css";

const STEPS: { key: keyof Totals; label: string }[] = [
  { key: "visitors", label: "Visited" },
  { key: "getStarted", label: "Clicked Get started" },
  { key: "opened", label: "Opened onboarding" },
  { key: "step2", label: "Reached step 2" },
  { key: "step3", label: "Reached step 3" },
  { key: "done", label: "Finished answers" },
  { key: "checkouts", label: "Opened checkout" },
  { key: "paid", label: "Paid" }
];

/** Step-by-step drop-off. Bar = share of visitors; the line under it = how many survived from the step before. */
export function DropoffFunnel({ totals }: { totals: Totals }) {
  const base = totals.visitors;
  return (
    <ol className={styles.funnelList}>
      {STEPS.map(({ key, label }, i) => {
        const value = totals[key];
        const prev = i === 0 ? null : totals[STEPS[i - 1].key];
        const width = base > 0 ? Math.min(100, (value / base) * 100) : 0;
        return (
          <li key={key} className={styles.funnelStep}>
            <div className={styles.funnelHead}>
              <span className={styles.funnelLabel}>{label}</span>
              <span className={styles.funnelValue}>{formatInt(value)} <span className={styles.muted}>{i === 0 ? "" : `${percent(value, base)} of visitors`}</span></span>
            </div>
            <div className={styles.funnelTrack}><div className={styles.funnelBar} style={{ width: `${Math.max(width, value > 0 ? 1.5 : 0)}%` }} /></div>
            {prev !== null ? (
              <div className={styles.funnelDrop}>{prev > 0 ? `${percent(value, prev)} of the step before${value > prev ? " (includes visits not linked to the step before)" : ""}` : "—"}</div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
