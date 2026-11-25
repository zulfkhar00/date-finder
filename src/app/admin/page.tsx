import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin-auth";
import { getCheckoutPanel, type CheckoutPanel } from "./_lib/checkout-data";
import { QualityNote } from "./_components/quality-note";
import { CheckoutPanelCard } from "./_components/checkout-panel";
import { AdminDataError, getOverview, type OverviewData } from "./_lib/data";
import { formatInt, percent } from "./_lib/format";
import { AlarmsRow } from "./_components/alarms";
import { DeltaBadge } from "./_components/delta";
import { DimTable } from "./_components/dim-table";
import { DailyChart } from "./_components/daily-chart";
import { FunnelTable, groupFunnel } from "./_components/funnel-table";
import { QueryErrorNotice, SchemaNotice, SetupNotice } from "./_components/notices";
import styles from "./admin.module.css";

const RANGES = { "7d": 7, "30d": 30, all: null } as const;
type RangeKey = keyof typeof RANGES;
const RANGE_LABELS: Record<RangeKey, string> = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" };

function overviewHref(range: RangeKey, includeSuspect: boolean) {
  const q = new URLSearchParams();
  if (range !== "30d") q.set("range", range);
  if (includeSuspect) q.set("suspect", "1");
  const qs = q.toString();
  return `/admin${qs ? `?${qs}` : ""}`;
}

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const params = await searchParams;
  const rangeParam = params.range;
  const includeSuspect = params.suspect === "1";
  const range: RangeKey = typeof rangeParam === "string" && Object.hasOwn(RANGES, rangeParam) ? (rangeParam as RangeKey) : "30d";

  let data: OverviewData | null = null;
  let problem: "schema" | "query" | null = null;
  try {
    data = await getOverview(RANGES[range], 30, includeSuspect);
  } catch (error) {
    problem = error instanceof AdminDataError && error.schemaMissing ? "schema" : "query";
  }

  // The Checkout panel is its own read: if it fails the rest of the overview still renders.
  let checkout: CheckoutPanel | null = null;
  try {
    checkout = await getCheckoutPanel(new Date(), includeSuspect);
  } catch {
    checkout = null;
  }

  const prev = data?.previous ?? null;
  const totals = data?.totals ?? { visitors: 0, getStarted: 0, reserveStarts: 0, onboardingComplete: 0, checkouts: 0, paid: 0 };

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Overview</h1>
          <p className={styles.sub}>Real traffic only: bots and (by default) suspect sessions, founders, test emails, Stripe test-mode checkouts and probe sessions are excluded. Visitors are browser tab sessions from funnel_events; checkouts and paid come from reservations. Days are UTC.</p>
        </div>
        <nav className={styles.segmented} aria-label="Date range">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link key={key} href={overviewHref(key, includeSuspect)} className={`${styles.segment} ${key === range ? styles.segmentActive : ""}`} aria-current={key === range ? "page" : undefined}>
              {RANGE_LABELS[key]}
            </Link>
          ))}
        </nav>
      </div>

      {problem === "schema" ? <SchemaNotice /> : null}
      {problem === "query" ? <QueryErrorNotice /> : null}

      {data ? (
        <>
          <AlarmsRow alarms={data.alarms} />
          <QualityNote includeSuspect={data.includeSuspect} note={data.filteredNote} suspectCount={data.suspectSessions} hrefToggle={overviewHref(range, !data.includeSuspect)} qualityColumn={data.qualityColumn} />

          <section className={styles.kpis} aria-label="Key numbers">
            <Kpi label="Visitors" value={formatInt(totals.visitors)} hint={RANGE_LABELS[range]} delta={<DeltaBadge current={totals.visitors} previous={prev?.visitors} />} />
            <Kpi label="Get started clicks" value={formatInt(totals.getStarted)} hint={`${percent(totals.getStarted, totals.visitors)} of visitors`} delta={<DeltaBadge current={totals.getStarted} previous={prev?.getStarted} />} />
            <Kpi label="Onboarding opened" value={formatInt(totals.reserveStarts)} hint={`${percent(totals.reserveStarts, totals.visitors)} of visitors`} delta={<DeltaBadge current={totals.reserveStarts} previous={prev?.reserveStarts} />} />
            <Kpi label="Onboarding done" value={formatInt(totals.onboardingComplete)} hint={`${percent(totals.onboardingComplete, totals.reserveStarts)} of opened`} delta={<DeltaBadge current={totals.onboardingComplete} previous={prev?.onboardingComplete} />} />
            <Kpi label="Checkouts opened" value={formatInt(totals.checkouts)} hint="Real reservations" delta={<DeltaBadge current={totals.checkouts} previous={prev?.checkouts} />} />
            <Kpi label="Paid" value={formatInt(data.paidInRange)} hint="Live-mode, non-founder" delta={<DeltaBadge current={data.paidInRange} previous={prev?.paid} />} />
            <Kpi label="Visitor → paid" value={percent(totals.paid, totals.visitors)} hint="Go at ≥3%" delta={prev && prev.visitors > 0 && totals.visitors > 0 ? <DeltaBadge current={(totals.paid / totals.visitors) * 100} previous={(prev.paid / prev.visitors) * 100} /> : null} />
            <Kpi label="Paid today" value={formatInt(data.paidToday)} hint="Since 00:00 UTC" />
            <Kpi label="Paid, last 7 days" value={formatInt(data.paid7d)} hint="Rolling 7 × 24 h" />
          </section>

          <p className={styles.sub}>Excluded in this range: {data.excluded.founder} founder, {data.excluded.test_email} test-email and {data.excluded.stripe_test} Stripe test-mode reservations; {data.excluded.internalSessions} internal funnel sessions.</p>

          <section className={styles.card}>
            <div className={styles.cardHead}><h2>Daily, last 30 days</h2></div>
            <DailyChart points={data.daily} />
          </section>

          <DimTable title="Top channels" dimension="Source" rows={data.topChannels} note={data.trafficCaptured ? undefined : "Source data is not captured yet (apply supabase/2026-11-03-traffic.sql); everything shows as (not captured)."} limit={5} />
          <p className={styles.sub}><Link href="/admin/traffic" className={styles.rowLink}>Open full traffic report</Link></p>

          {checkout ? <CheckoutPanelCard panel={checkout} /> : <p className={styles.sub}>The Checkout panel could not be loaded.</p>}

          <div className={styles.grid2}>
            <FunnelTable title="Funnel by variant" dimension="Variant" rows={groupFunnel(data.funnel, "variant")} />
            <FunnelTable title="Funnel by campaign" dimension="utm_campaign" rows={groupFunnel(data.funnel, "utm_campaign")} />
          </div>
        </>
      ) : null}
    </main>
  );
}

function Kpi({ label, value, hint, delta }: { label: string; value: string; hint?: string; delta?: ReactNode }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiValue}>{value}</div>
      {delta ? <div className={styles.kpiDelta}>{delta}</div> : null}
      {hint ? <div className={styles.kpiHint}>{hint}</div> : null}
    </div>
  );
}
