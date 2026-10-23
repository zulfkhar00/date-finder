import Link from "next/link";
import { requireAdminPage } from "../_lib/auth";
import {
  AdminDataError,
  DEFAULT_VARIANT_LABEL,
  LEADS_PAGE_SIZE,
  NO_CAMPAIGN_LABEL,
  RESERVATION_STATUSES,
  getLeadFacets,
  listLeads,
  parseLeadFilters,
  type LeadFilters,
  type LeadWithStage
} from "../_lib/data";
import { STAGE_LABELS, STATUS_LABELS, formatDateTime, formatInt } from "../_lib/format";
import { GetForm } from "../_components/get-form";
import { Badge, QueryErrorNotice, SchemaNotice, SetupNotice } from "../_components/notices";
import styles from "../admin.module.css";

function filterQuery(filters: LeadFilters, page?: number): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.variant) params.set("variant", filters.variant);
  if (filters.campaign) params.set("campaign", filters.campaign);
  if (filters.q) params.set("q", filters.q);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "";
}

const PREFERENCE_SHORT: Record<string, string> = { women: "Women", men: "Men", all_genders: "Any gender", discuss: "Discuss" };
const GOAL_SHORT: Record<string, string> = { committed: "Committed", meaningful: "Meaningful", exploring: "Exploring" };
const FREQUENCY_SHORT: Record<string, string> = { monthly: "Monthly", twice_monthly: "2× / month", weekly: "Weekly" };

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const { page, ...filters } = parseLeadFilters(await searchParams);
  const [facets, result] = await Promise.all([
    getLeadFacets(),
    listLeads(filters, page).then(
      (value) => ({ ...value, problem: null }),
      (error: unknown) => ({
        rows: [] as LeadWithStage[],
        total: 0,
        problem: error instanceof AdminDataError && error.schemaMissing ? ("schema" as const) : ("query" as const)
      })
    )
  ]);
  const { rows, total, problem } = result;

  const variants = [...new Set([DEFAULT_VARIANT_LABEL, ...facets.variants, ...(filters.variant ? [filters.variant] : [])])];
  const campaigns = [...new Set([...facets.campaigns, ...(filters.campaign ? [filters.campaign] : [])])];
  const pages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * LEADS_PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * LEADS_PAGE_SIZE);
  const hasFilters = Boolean(filters.status || filters.variant || filters.campaign || filters.q);

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Leads</h1>
          <p className={styles.sub}>Every reservation, newest first. Times are UTC.</p>
        </div>
        <a className={styles.buttonGhost} href={`/admin/leads/export${filterQuery(filters)}`} download>
          Export CSV{hasFilters ? " (filtered)" : ""}
        </a>
      </div>

      <section className={styles.card}>
        <GetForm action="/admin/leads" submitLabel="Apply">
          <label className={styles.field}>
            Search email
            <input className={styles.input} type="search" name="q" defaultValue={filters.q ?? ""} placeholder="name@" maxLength={254} />
          </label>
          <label className={styles.field}>
            Status
            <select className={styles.select} name="status" defaultValue={filters.status ?? ""}>
              <option value="">All</option>
              {RESERVATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Variant
            <select className={styles.select} name="variant" defaultValue={filters.variant ?? ""}>
              <option value="">All</option>
              {variants.map((variant) => <option key={variant} value={variant}>{variant}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Campaign
            <select className={styles.select} name="campaign" defaultValue={filters.campaign ?? ""}>
              <option value="">All</option>
              {campaigns.map((campaign) => <option key={campaign} value={campaign}>{campaign}</option>)}
            </select>
          </label>
          {hasFilters ? <Link href="/admin/leads" className={styles.buttonGhost}>Clear</Link> : null}
        </GetForm>
      </section>

      {problem === "schema" ? <SchemaNotice /> : null}
      {problem === "query" ? <QueryErrorNotice /> : null}

      <section className={styles.card}>
        {rows.length === 0 ? (
          <div className={styles.empty}>{problem ? "No data." : hasFilters ? "No leads match these filters." : "No reservations yet."}</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Email</th>
                  <th>City</th>
                  <th>Preferences</th>
                  <th>Status</th>
                  <th className={styles.num}>Queue #</th>
                  <th>Variant</th>
                  <th>Campaign</th>
                  <th>Paid at</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.nowrap}>{formatDateTime(row.created_at)}</td>
                    <td><Link href={`/admin/leads/${row.id}`} className={styles.rowLink}>{row.email}</Link></td>
                    <td>{row.city}</td>
                    <td className={styles.muted}>
                      {[PREFERENCE_SHORT[row.dating_preference], GOAL_SHORT[row.relationship_goal], FREQUENCY_SHORT[row.date_frequency]].filter(Boolean).join(" · ")}
                    </td>
                    <td><Badge value={row.status} label={STATUS_LABELS[row.status]} /></td>
                    <td className={styles.num}>{row.queue_position ?? "—"}</td>
                    <td>{row.variant ?? DEFAULT_VARIANT_LABEL}</td>
                    <td>{row.utm_campaign ?? <span className={styles.muted}>{NO_CAMPAIGN_LABEL}</span>}</td>
                    <td className={styles.nowrap}>{formatDateTime(row.paid_at)}</td>
                    <td><Badge value={row.stage} label={STAGE_LABELS[row.stage]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className={styles.pager}>
          <span>{total === 0 ? "0 leads" : `${formatInt(firstRow)}–${formatInt(lastRow)} of ${formatInt(total)}`}</span>
          <div className={styles.pagerLinks}>
            <Link href={`/admin/leads${filterQuery(filters, page - 1)}`} className={`${styles.buttonGhost} ${page <= 1 ? styles.disabledLink : ""}`} aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined}>
              Previous
            </Link>
            <Link href={`/admin/leads${filterQuery(filters, page + 1)}`} className={`${styles.buttonGhost} ${page >= pages ? styles.disabledLink : ""}`} aria-disabled={page >= pages} tabIndex={page >= pages ? -1 : undefined}>
              Next
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
