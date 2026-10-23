import type { FunnelRow } from "../_lib/data";
import { formatInt, percent } from "../_lib/format";
import styles from "../admin.module.css";

type Totals = Omit<FunnelRow, "variant" | "utm_campaign">;

/** Sums first-touch funnel rows by one dimension. Each session is in exactly one row, so sums are exact. */
export function groupFunnel(rows: FunnelRow[], key: "variant" | "utm_campaign"): (Totals & { label: string })[] {
  const groups = new Map<string, Totals & { label: string }>();
  for (const row of rows) {
    const label = row[key];
    const g = groups.get(label) ?? { label, visitors: 0, reserve_starts: 0, checkouts: 0, paid: 0 };
    g.visitors += row.visitors;
    g.reserve_starts += row.reserve_starts;
    g.checkouts += row.checkouts;
    g.paid += row.paid;
    groups.set(label, g);
  }
  return [...groups.values()].sort((a, b) => b.visitors - a.visitors || a.label.localeCompare(b.label));
}

export function FunnelTable({ title, dimension, rows }: { title: string; dimension: string; rows: (Totals & { label: string })[] }) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHead}><h2>{title}</h2></div>
      {rows.length === 0 ? (
        <div className={styles.empty}>No funnel events in this range yet.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{dimension}</th>
                <th className={styles.num}>Visitors</th>
                <th className={styles.num}>Reserve starts</th>
                <th className={styles.num}>Checkouts</th>
                <th className={styles.num}>Paid</th>
                <th className={styles.num}>Visitor→start</th>
                <th className={styles.num}>Visitor→paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className={styles.num}>{formatInt(row.visitors)}</td>
                  <td className={styles.num}>{formatInt(row.reserve_starts)}</td>
                  <td className={styles.num}>{formatInt(row.checkouts)}</td>
                  <td className={styles.num}>{formatInt(row.paid)}</td>
                  <td className={styles.num}>{percent(row.reserve_starts, row.visitors)}</td>
                  <td className={styles.num}>{percent(row.paid, row.visitors)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
