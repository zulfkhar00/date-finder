import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listReports, runSlaSweep } from "@/lib/reports/service";
import { CATEGORIES, CATEGORY_LABELS, OPEN_STATUSES, STATUSES, STATUS_LABELS, compareQueue, formatAge, formatRemaining, isCategory, slaFor, type Category, type Status } from "@/lib/reports/core";
import { GetForm } from "../_components/get-form";
import { LocalTime } from "../_components/local-time";
import { SetupNotice } from "../_components/notices";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

type Search = { status?: string; category?: string };

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const sb = getSupabaseAdmin();
  const search = await searchParams;
  const statusFilter = (STATUSES as readonly string[]).includes(search.status ?? "") ? (search.status as Status) : search.status === "open" ? "open" : null;
  const categoryFilter: Category | null = isCategory(search.category) ? search.category : null;
  const now = new Date();

  // Opening the queue also announces any breach nobody has been told about yet (once per breach).
  await runSlaSweep(sb, now).catch(() => undefined);
  const { rows, groupCounts, setupNeeded } = await listReports(sb);
  const filtered = rows
    .filter((r) => (statusFilter === null ? true : statusFilter === "open" ? (OPEN_STATUSES as readonly string[]).includes(r.status) : r.status === statusFilter))
    .filter((r) => (categoryFilter ? r.category === categoryFilter : true))
    .sort((a, b) => compareQueue(a, b, now));
  const open = rows.filter((r) => (OPEN_STATUSES as readonly string[]).includes(r.status));
  const overdue = open.filter((r) => slaFor(r, now).overdue).length;
  const urgentOpen = open.filter((r) => r.urgent).length;
  const link = (s: string | null) => `/admin/reports${s || categoryFilter ? `?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(categoryFilter ? { category: categoryFilter } : {}) })}` : ""}`;

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Reports</h1>
          <p className={styles.sub}>Takedown queue. Acknowledge within 24 h, resolve within 72 h. Urgent reports (minor safety, trafficking, non-consensual images, threats, or someone in danger) come first with a 4 h target. Appeals: 7 days. Times show in your time zone.</p>
        </div>
      </div>

      {setupNeeded ? <div className={styles.notice}>Reports are not set up yet. Apply <code>supabase/2026-11-20-reports.sql</code> in the Supabase SQL editor.</div> : null}

      <div className={styles.kpis}>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Open</div><div className={styles.kpiValue}>{open.length}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Urgent open</div><div className={styles.kpiValue} data-tone={urgentOpen ? "warn" : undefined}>{urgentOpen}</div></div>
        <div className={styles.kpi}><div className={styles.kpiLabel}>Overdue</div><div className={styles.kpiValue} style={overdue ? { color: "var(--coral-deep)" } : undefined} data-testid="overdue-count">{overdue}</div></div>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <nav className={styles.segmented} aria-label="Status filter">
            {[{ v: null, l: "All" }, { v: "open", l: "Open" }, ...STATUSES.map((s) => ({ v: s as string, l: STATUS_LABELS[s] }))].map(({ v, l }) => {
              const active = (v ?? null) === (statusFilter ?? null);
              return <Link key={l} href={link(v)} className={`${styles.segment} ${active ? styles.segmentActive : ""}`} aria-current={active ? "page" : undefined}>{l}</Link>;
            })}
          </nav>
          <GetForm action="/admin/reports" submitLabel="Filter">
            {search.status ? <input type="hidden" name="status" value={search.status} /> : null}
            <label className={styles.field}>Category
              <select className={styles.select} name="category" defaultValue={categoryFilter ?? ""}>
                <option value="">All categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </label>
          </GetForm>
        </div>
        {!filtered.length ? <div className={styles.empty}>{setupNeeded ? "Nothing to show until the migration is applied." : "No reports match."}</div> : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Ref</th><th>Category</th><th>Status</th><th>Age</th><th>SLA</th><th className={styles.hideSm}>Received</th><th className={styles.hideSm}>App</th><th>Same profile</th></tr></thead>
              <tbody>
                {filtered.map((r) => {
                  const sla = slaFor(r, now);
                  const group = r.group_key ? groupCounts.get(r.group_key) ?? 1 : 1;
                  return (
                    <tr key={r.id} data-urgent={r.urgent && sla.kind ? "true" : undefined} data-overdue={sla.overdue ? "true" : undefined} className={`${r.urgent && sla.kind ? styles.rowUrgent : ""} ${sla.overdue ? styles.rowOverdue : ""}`}>
                      <td className={styles.nowrap}><Link href={`/admin/reports/${r.id}`} className={styles.rowLink}>{r.ref}</Link></td>
                      <td>{r.urgent ? <span className={styles.badge} data-tone="warn">Urgent</span> : null} {CATEGORY_LABELS[r.category]}</td>
                      <td><span className={styles.badge}>{STATUS_LABELS[r.status]}</span></td>
                      <td className={styles.nowrap}>{formatAge(now.getTime() - new Date(r.created_at).getTime())}</td>
                      <td className={styles.nowrap}>
                        {sla.kind && sla.remainingMs !== null
                          ? <span className={sla.overdue ? styles.slaOver : styles.slaOk}>{sla.kind === "acknowledge" ? "Acknowledge" : sla.kind === "appeal" ? "Appeal" : "Resolve"}: {formatRemaining(sla.remainingMs)}</span>
                          : <span className={styles.muted}>Done</span>}
                      </td>
                      <td className={`${styles.nowrap} ${styles.hideSm}`}><LocalTime iso={r.created_at} /></td>
                      <td className={styles.hideSm}>{r.dating_app ?? "—"}</td>
                      <td>{group > 1 ? <span className={styles.badge}>{group} reports</span> : <span className={styles.muted}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
