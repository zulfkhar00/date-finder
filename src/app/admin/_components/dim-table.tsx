import type { DimRow } from "@/lib/traffic-report";
import { formatInt, percent } from "../_lib/format";
import styles from "../admin.module.css";

/**
 * One breakdown (channel, landing page, device, country) with the funnel steps.
 * On phones the middle steps fold away (hideSm) so the table fits the card; it also scrolls
 * inside its own card, never the page. `full` shows every step.
 */
export function DimTable({ title, dimension, rows, full = false, note, limit = 12 }: { title: string; dimension: string; rows: DimRow[]; full?: boolean; note?: string; limit?: number }) {
  const shown = rows.slice(0, limit);
  const hidden = rows.length - shown.length;
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h2>{title}</h2></div>
      {note ? <p className={`${styles.sub} ${styles.noteTight}`}>{note}</p> : null}
      {shown.length === 0 ? (
        <div className={styles.empty}>No data in this range yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{dimension}</th>
                <th className={styles.num}>Visitors</th>
                <th className={styles.num}>Started</th>
                {full ? <th className={`${styles.num} ${styles.hideSm}`}>Opened</th> : null}
                {full ? <th className={`${styles.num} ${styles.hideSm}`}>Step 2</th> : null}
                {full ? <th className={`${styles.num} ${styles.hideSm}`}>Step 3</th> : null}
                {full ? <th className={`${styles.num} ${styles.hideSm}`}>Done</th> : null}
                {full ? <th className={`${styles.num} ${styles.hideSm}`}>Checkout</th> : null}
                <th className={styles.num}>Paid</th>
                <th className={styles.num}>Visitor→paid</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td className={styles.cellKey}>{r.key}</td>
                  <td className={styles.num}>{formatInt(r.visitors)}</td>
                  <td className={styles.num}>{formatInt(r.getStarted)}</td>
                  {full ? <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.opened)}</td> : null}
                  {full ? <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.step2)}</td> : null}
                  {full ? <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.step3)}</td> : null}
                  {full ? <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.done)}</td> : null}
                  {full ? <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.checkouts)}</td> : null}
                  <td className={styles.num}>{formatInt(r.paid)}</td>
                  <td className={styles.num}>{percent(r.paid, r.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hidden > 0 ? <p className={styles.sub}>+ {hidden} more not shown.</p> : null}
    </section>
  );
}
