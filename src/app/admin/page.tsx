import Link from "next/link";
import { requireAdminPage } from "./_lib/auth";
import { AdminDataError, getOverview, type OverviewData } from "./_lib/data";
import { formatInt, percent } from "./_lib/format";
import { DailyChart } from "./_components/daily-chart";
import { FunnelTable, groupFunnel } from "./_components/funnel-table";
import { QueryErrorNotice, SchemaNotice, SetupNotice } from "./_components/notices";
import styles from "./admin.module.css";

const RANGES = { "7d": 7, "30d": 30, all: null } as const;
type RangeKey = keyof typeof RANGES;
const RANGE_LABELS: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const rangeParam = (await searchParams).range;
  const range: RangeKey = typeof rangeParam === "string" && rangeParam in RANGES ? (rangeParam as RangeKey) : "30d";

  let data: OverviewData | null = null;
  let problem: "schema" | "query" | null = null;
  try {
    data = await getOverview(RANGES[range], 30);
  } catch (error) {
    problem = error instanceof AdminDataError && error.schemaMissing ? "schema" : "query";
  }

  const totals = (data?.funnel ?? []).reduce(
    (acc, row) => ({
      visitors: acc.visitors + row.visitors,
      starts: acc.starts + row.reserve_starts,
      checkouts: acc.checkouts + row.checkouts,
      paid: acc.paid + row.paid
    }),
    { visitors: 0, starts: 0, checkouts: 0, paid: 0 }
  );

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Overview</h1>
          <p className={styles.sub}>Visitors are browser tab sessions from funnel_events. Paid counts come from reservations. Days are UTC.</p>
        </div>
        <nav className={styles.segmented} aria-label="Date range">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link key={key} href={key === "30d" ? "/admin" : `/admin?range=${key}`} className={`${styles.segment} ${key === range ? styles.segmentActive : ""}`} aria-current={key === range ? "page" : undefined}>
              {RANGE_LABELS[key]}
            </Link>
          ))}
        </nav>
      </div>

      {problem === "schema" ? <SchemaNotice /> : null}
      {problem === "query" ? <QueryErrorNotice /> : null}

      {data ? (
        <>
          <section className={styles.kpis} aria-label="Key numbers">
            <Kpi label="Visitors" value={formatInt(totals.visitors)} hint={RANGE_LABELS[range]} />
            <Kpi label="Reserve starts" value={formatInt(totals.starts)} hint={`${percent(totals.starts, totals.visitors)} of visitors`} />
            <Kpi label="Checkouts" value={formatInt(totals.checkouts)} hint={`${percent(totals.checkouts, totals.starts)} of starts`} />
            <Kpi label="Paid" value={formatInt(data.paidInRange)} hint={`${formatInt(totals.paid)} attributed to a session`} />
            <Kpi label="Visitor → paid" value={percent(totals.paid, totals.visitors)} hint="Go at ≥3%" />
            <Kpi label="Paid today" value={formatInt(data.paidToday)} hint="Since 00:00 UTC" />
            <Kpi label="Paid, last 7 days" value={formatInt(data.paid7d)} hint="Rolling 7 × 24 h" />
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}><h2>Daily, last 30 days</h2></div>
            <DailyChart points={data.daily} />
          </section>

          <div className={styles.grid2}>
            <FunnelTable title="Funnel by variant" dimension="Variant" rows={groupFunnel(data.funnel, "variant")} />
            <FunnelTable title="Funnel by campaign" dimension="utm_campaign" rows={groupFunnel(data.funnel, "utm_campaign")} />
          </div>
        </>
      ) : null}
    </main>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {hint ? <div className={styles.kpiHint}>{hint}</div> : null}
    </div>
  );
}
