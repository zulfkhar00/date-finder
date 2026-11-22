import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { APPS, APP_LABELS } from "@/lib/app/domain";
import { SLA_LABELS, appStatusLabel, applyFilters, isWaiting, parseFilters, type QueueRow } from "@/lib/fulfilment/core";
import { OPS_STATUSES, applyOpsFilters, compareSla, parseOpsFilters, queueCounts, settingUpApps, SETUP_ALERT_HOURS } from "@/lib/operator/queue";
import { CHECKLIST_STEPS } from "@/lib/operator/checklist";
import { loadQueue } from "@/lib/fulfilment/service";
import { paidCountries } from "@/lib/paid-countries";
import { GetForm } from "../_components/get-form";
import { LocalTime } from "../_components/local-time";
import { SetupNotice } from "../_components/notices";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fulfilment" };

type Search = { paid?: string; country?: string; app?: string; status?: string; min?: string; internal?: string };

function Waiting({ row }: { row: QueueRow }) {
  if (row.hold) return <span className={`${styles.badge} ${styles.badge_held}`}>On hold (report)</span>;
  if (!isWaiting(row)) return <span className={styles.muted}>Handled</span>;
  return <span className={`${styles.badge} ${styles[`badge_sla_${row.sla}`]}`} title={SLA_LABELS[row.sla]} data-sla={row.sla}>{row.hoursWaiting} h</span>;
}

export default async function AdminFulfilmentPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const search = await searchParams;
  const filters = parseFilters(search);
  const ops = parseOpsFilters(search);
  const now = new Date();
  const queue = await loadQueue(undefined, now, { includeInternal: true });
  const all = [...queue.rows].sort(compareSla);
  const rows = applyOpsFilters(applyFilters(all, filters), ops);
  const counts = queueCounts(all);
  const realCount = all.filter((r) => !r.internal).length;
  const list = paidCountries().join(", ");

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Fulfilment queue</h1>
          <p className={styles.sub}>Everyone who finished onboarding, paid first, longest wait first. The wait starts when they finished onboarding or paid, whichever came later. Green under 24 h, amber 24 to 72 h, red over 72 h (we tell clients 72 h). Sorted by SLA: paid clients still setting up first, longest wait first. Unpaid clients outside {list} are not on the clock. Paid clients still setting up after {SETUP_ALERT_HOURS} h raise an ops alert. Internal and test accounts are never counted; tick &ldquo;Show internal&rdquo; to list them with a badge. Times show in your time zone.</p>
        </div>
      </div>

      {queue.setupNeeded.events ? <div className={styles.notice}>The status log is not set up yet. Apply <code>supabase/2026-11-20-fulfilment.sql</code> in the Supabase SQL editor.</div> : null}
      {queue.truncated ? <div className={styles.notice}>Showing the first 1000 onboarded clients.</div> : null}

      <div className={styles.kpis}>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Paid, waiting</div><div className={styles.kpiValue} data-testid="paid-waiting">{counts.waiting}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Over 24 h</div><div className={styles.kpiValue} data-testid="over-24">{counts.over24}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Over 48 h (alert)</div><div className={styles.kpiValue} data-tone={counts.over48 ? "warn" : undefined} data-testid="over-48">{counts.over48}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Over 72 h</div><div className={styles.kpiValue} data-tone={counts.over72 ? "warn" : undefined} data-testid="over-72">{counts.over72}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Apps needing the client</div><div className={styles.kpiValue} data-testid="needs-you">{counts.needsYou}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Apps setting up / running</div><div className={styles.kpiValue}>{counts.settingUp} / {counts.active}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Onboarded (real)</div><div className={styles.kpiValue}>{realCount}</div></div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <GetForm action="/admin/fulfilment" submitLabel="Filter">
            <label className={styles.field}>Payment
              <select className={styles.select} name="paid" defaultValue={filters.paid ?? ""}><option value="">Paid and unpaid</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option></select>
            </label>
            <label className={styles.field}>Country
              <select className={styles.select} name="country" defaultValue={filters.country ?? ""}><option value="">Any country</option><option value="supported">Supported</option><option value="unsupported">Unsupported</option><option value="unknown">Unknown</option></select>
            </label>
            <label className={styles.field}>App
              <select className={styles.select} name="app" defaultValue={filters.app ?? ""}><option value="">Any app</option>{APPS.map((a) => <option key={a} value={a}>{APP_LABELS[a]}</option>)}</select>
            </label>
            <label className={styles.field}>App status
              <select className={styles.select} name="status" defaultValue={ops.status ?? ""}><option value="">Any status</option>{OPS_STATUSES.map((st) => <option key={st} value={st}>{st.replace(/_/g, " ")}</option>)}</select>
            </label>
            <label className={styles.field}>Waiting
              <select className={styles.select} name="min" defaultValue={ops.minHours ? String(ops.minHours) : ""}><option value="">Any time</option><option value="24">Over 24 h</option><option value="48">Over 48 h</option><option value="72">Over 72 h</option></select>
            </label>
            <label className={styles.field}>Internal
              <select className={styles.select} name="internal" defaultValue={ops.internal ? "1" : ""}><option value="">Hide internal</option><option value="1">Show internal</option></select>
            </label>
          </GetForm>
          {filters.paid || filters.country || filters.app || ops.status || ops.minHours || ops.internal ? <Link href="/admin/fulfilment" className={styles.rowLink}>Clear filters</Link> : null}
        </div>
        {!rows.length ? <div className={styles.empty}>{all.length ? "No clients match these filters." : "Nobody has finished onboarding yet."}</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table} data-testid="fulfilment-table">
              <thead><tr><th>Waiting</th><th>Client</th><th className={styles.hideSm}>Paid</th><th className={styles.hideSm}>Country</th><th>Apps</th><th className={styles.hideSm}>Pack</th><th className={styles.hideSm}>Photos</th><th className={styles.hideSm}>Signed up</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.userId} data-paid={r.paid ? "true" : "false"}>
                    <td className={styles.nowrap}><Waiting row={r} /></td>
                    <td>
                      <Link href={`/admin/clients/${r.userId}`} className={styles.rowLink}>{r.firstName || "Unnamed"}</Link>{" "}
                      {r.internal ? <span className={styles.badge} data-testid="internal-badge">internal</span> : null}{" "}
                      <span className={`${styles.badge} ${r.paid ? styles.badge_paid : ""}`} data-testid="paid-badge">{r.paid ? "Paid" : "Unpaid"}</span>
                      <span className={`${styles.appReason} fx-email`} style={{ overflowWrap: "anywhere" }}>{r.email}</span>
                      {r.countrySupport === "unsupported" ? <span className={styles.badge} data-tone="warn">{r.country} unsupported</span> : null}
                    </td>
                    <td className={styles.hideSm}>{r.paid ? <span className={`${styles.badge} ${styles.badge_paid}`}>Paid</span> : <span className={styles.badge}>Unpaid</span>}</td>
                    <td className={styles.hideSm}>{r.country ?? "—"}{r.countrySupport === "unsupported" ? <> <span className={styles.badge} data-tone="warn">unsupported</span></> : null}</td>
                    <td>
                      {r.apps.length ? r.apps.map((a) => (
                        <span key={a.app} className={styles.appLine}>
                          <strong>{APP_LABELS[a.app]}</strong>: {appStatusLabel(a, r.hold)}
                          {settingUpApps(r).some((x) => x.app === a.app) ? <> <span className={styles.muted}>{a.stepsDone ?? 0}/{CHECKLIST_STEPS.length} steps</span></> : null}{" "}<Link href={`/admin/clients/${r.userId}/kit`} className={styles.rowLink}>kit</Link>
                          {!r.hold && a.status === "needs_client_action" && a.reason ? <span className={styles.appReason}>{a.reason}</span> : null}
                        </span>
                      )) : <span className={styles.muted}>No apps chosen</span>}
                    </td>
                    <td className={styles.hideSm}>{r.packStatus ?? <span className={styles.muted}>none</span>}</td>
                    <td className={styles.hideSm}>{r.photoCount}{r.flaggedPhotos ? <> <span className={styles.badge} data-tone="warn">{r.flaggedPhotos} flagged</span></> : null}</td>
                    <td className={`${styles.nowrap} ${styles.hideSm}`}><LocalTime iso={r.createdAt} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
