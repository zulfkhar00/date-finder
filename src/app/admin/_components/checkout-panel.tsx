import type { CheckoutDimRow } from "@/lib/checkout-report";
import type { CheckoutPanel } from "../_lib/checkout-data";
import { formatInt } from "../_lib/format";
import styles from "../admin.module.css";

const pct = (value: number | null) => (value === null ? "–" : `${value}%`);

/** Last 30 days of Checkout Sessions: where each one stopped and why, real users only. */
export function CheckoutPanelCard({ panel }: { panel: CheckoutPanel }) {
  const { steps, outcomes } = panel;
  return (
    <section className={styles.card} aria-labelledby="checkout-panel-heading">
      <div className={styles.cardHead}><h2 id="checkout-panel-heading">Checkout, last 30 days</h2></div>
      <p className={`${styles.sub} ${styles.noteTight}`}>
        Per Checkout Session, real users only (founders, test emails, &ldquo;Integration test&rdquo; rows, Stripe test mode, probe sessions and bots excluded). Opened and paid come from reservations; the rest from the payment form and Stripe&rsquo;s webhook.
      </p>
      {!panel.diagnosticsCaptured ? <p className={styles.sub}>Payment-form and Stripe failure events are not captured yet (apply supabase/2026-11-20-checkout-forensics.sql); only opened and paid are real.</p> : null}
      {panel.diagnosticsCaptured && !panel.geoCaptured ? <p className={styles.sub}>No country or device captured yet.</p> : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Step</th><th className={styles.num}>Checkouts</th><th className={styles.num}>Of opened</th><th className={`${styles.num} ${styles.hideSm}`}>Of previous step</th></tr></thead>
          <tbody>
            {steps.map((s) => (
              <tr key={s.key}>
                <td className={styles.cellKey} style={{ overflowWrap: "normal" }}>{s.label}</td>
                <td className={styles.num}>{formatInt(s.count)}</td>
                <td className={styles.num}>{pct(s.pctOfOpened)}</td>
                <td className={`${styles.num} ${styles.hideSm}`}>{pct(s.pctOfPrevious)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.sub}>
        How they ended: {formatInt(outcomes.paid)} paid, {formatInt(outcomes.failed)} failed (card or form error, never paid), {formatInt(outcomes.expired)} expired, {formatInt(outcomes.left)} left the page, {formatInt(outcomes.open)} no signal.
        {panel.paidWithoutBrowserEvents > 0 ? ` ${formatInt(panel.paidWithoutBrowserEvents)} paid checkout(s) sent no browser events (ad blocker, or paid before this tracking).` : ""}
      </p>

      <h3 className={styles.sub}>Failures by code</h3>
      {panel.failures.length === 0 ? <div className={styles.empty}>No failures recorded in this range.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Code / decline code</th><th className={styles.hideSm}>Source</th><th className={`${styles.num} ${styles.hideSm}`}>Attempts</th><th className={styles.num}>Checkouts</th><th className={styles.num}>Paid later</th></tr></thead>
            <tbody>
              {panel.failures.map((f) => (
                <tr key={`${f.source}|${f.reason}`}>
                  <td className={styles.cellKey}>{f.source === "browser" ? `${f.reason} (browser)` : f.reason}</td>
                  <td className={styles.hideSm}>{f.source === "stripe" ? "Stripe" : "Browser"}</td>
                  <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(f.attempts)}</td>
                  <td className={styles.num}>{formatInt(f.checkouts)}</td>
                  <td className={styles.num}>{formatInt(f.recovered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {panel.unlinkedFailures > 0 ? <p className={styles.sub}>{formatInt(panel.unlinkedFailures)} failure(s) from Stripe could not be tied to a checkout session.</p> : null}

      <div className={styles.grid2}>
        <DimTable title="By country (visitor IP)" dimension="Country" rows={panel.byCountry} />
        <DimTable title="By device" dimension="Device" rows={panel.byDevice} />
      </div>

      <h3 className={styles.sub}>Card country of failed payments (Stripe)</h3>
      {panel.failedCardCountries.length === 0 ? <div className={styles.empty}>None yet.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Card country</th><th className={styles.num}>Failed attempts</th></tr></thead>
            <tbody>
              {panel.failedCardCountries.map((c) => <tr key={c.key}><td className={styles.cellKey}>{c.key}</td><td className={styles.num}>{formatInt(c.attempts)}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DimTable({ title, dimension, rows }: { title: string; dimension: string; rows: CheckoutDimRow[] }) {
  return (
    <div>
      <h3 className={styles.sub}>{title}</h3>
      {rows.length === 0 ? <div className={styles.empty}>No checkouts in this range.</div> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>{dimension}</th><th className={styles.num}>Opened</th><th className={`${styles.num} ${styles.hideSm}`}>Form</th><th className={`${styles.num} ${styles.hideSm}`}>Submitted</th><th className={styles.num}>Failed</th><th className={styles.num}>Paid</th></tr></thead>
            <tbody>
              {rows.slice(0, 12).map((r) => (
                <tr key={r.key}>
                  <td className={styles.cellKey}>{r.key}</td>
                  <td className={styles.num}>{formatInt(r.opened)}</td>
                  <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.ready)}</td>
                  <td className={`${styles.num} ${styles.hideSm}`}>{formatInt(r.submitted)}</td>
                  <td className={styles.num}>{formatInt(r.failed)}</td>
                  <td className={styles.num}>{formatInt(r.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
