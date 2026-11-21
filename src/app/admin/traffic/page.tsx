import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdminPage } from "@/lib/admin-auth";
import { conversion, type RangeKey } from "@/lib/traffic-report";
import { AdminDataError } from "../_lib/data";
import { formatDateTime, formatDuration, formatInt, percent } from "../_lib/format";
import { DeltaBadge } from "../_components/delta";
import { DimTable } from "../_components/dim-table";
import { DropoffFunnel } from "../_components/dropoff-funnel";
import { QueryErrorNotice, SetupNotice } from "../_components/notices";
import { StackedChart } from "../_components/stacked-chart";
import { getTrafficPage, type SourceWindow, type TrafficPageData } from "./data";
import { SourcesSection } from "./sources-section";
import styles from "../admin.module.css";

const RANGES: Record<RangeKey, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days", all: "All time" };
const MIGRATION = "supabase/2026-11-03-traffic.sql";

export default async function AdminTrafficPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const params = await searchParams;
  const rangeParam = params.range;
  const sourcesWindow: SourceWindow = params.sources === "7d" ? "7d" : "30d";
  const range: RangeKey = typeof rangeParam === "string" && Object.hasOwn(RANGES, rangeParam) ? (rangeParam as RangeKey) : "7d";

  let data: TrafficPageData | null = null;
  let problem = false;
  try {
    data = await getTrafficPage(range, sourcesWindow);
  } catch (error) {
    problem = true;
    if (!(error instanceof AdminDataError)) console.error("Admin traffic page failed");
  }

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Traffic</h1>
          <p className={styles.sub}>Real visits only: founders, test emails, Stripe test checkouts and probe sessions are excluded. Channel = utm_source, else referrer host, else in-app browser, else direct. Times are UTC.</p>
        </div>
        <nav className={styles.segmented} aria-label="Date range">
          {(Object.keys(RANGES) as RangeKey[]).map((key) => (
            <Link key={key} href={key === "7d" ? "/admin/traffic" : `/admin/traffic?range=${key}`} className={`${styles.segment} ${key === range ? styles.segmentActive : ""}`} aria-current={key === range ? "page" : undefined}>
              {RANGES[key]}
            </Link>
          ))}
        </nav>
      </div>

      {problem ? <QueryErrorNotice /> : null}
      {data ? <TrafficBody data={data} range={range} /> : null}
    </main>
  );
}

function TrafficBody({ data, range }: { data: TrafficPageData; range: RangeKey }) {
  const { current: c, previous: p, live } = data;
  const t = c.totals;
  const pt = p?.totals;
  const convNow = conversion(t.paid, t.visitors);
  const convPrev = p ? conversion(p.totals.paid, p.totals.visitors) : null;
  const beforeCapture = data.captureSince !== null && c.fromMs < data.captureSince;
  const compare = p ? `vs previous ${RANGES[data.range]}` : "";

  return (
    <>
      {!data.trafficColumns ? (
        <div className={styles.notice}>Source, landing page, device and country are not being captured yet. Apply <code>{MIGRATION}</code> in the Supabase SQL editor; until then every visit shows as <code>(not captured)</code>.</div>
      ) : data.captureSince === null ? (
        <div className={styles.notice}>The traffic columns exist but no visit has been recorded with them yet. They fill in as new visitors arrive.</div>
      ) : beforeCapture ? (
        <div className={styles.notice}>
          Source, landing page, device and country were not captured before {formatDateTime(new Date(data.captureSince).toISOString())}. Visits from before then are grouped as <code>(not captured)</code>
          {c.capturedShare !== null ? ` (${Math.round((1 - c.capturedShare) * 100)}% of visitors in this range)` : ""}; they are real visits, just without a source.
        </div>
      ) : null}

      <section className={styles.kpis} aria-label="Key numbers">
        <Kpi label="Visitors" value={formatInt(t.visitors)} delta={<DeltaBadge current={t.visitors} previous={pt?.visitors} />} hint={compare} />
        <Kpi label="Get started" value={formatInt(t.getStarted)} delta={<DeltaBadge current={t.getStarted} previous={pt?.getStarted} />} hint={`${percent(t.getStarted, t.visitors)} of visitors`} />
        <Kpi label="Onboarding done" value={formatInt(t.done)} delta={<DeltaBadge current={t.done} previous={pt?.done} />} hint={`${percent(t.done, t.opened)} of opened`} />
        <Kpi label="Checkouts" value={formatInt(t.checkouts)} delta={<DeltaBadge current={t.checkouts} previous={pt?.checkouts} />} hint="Real reservations" />
        <Kpi label="Paid" value={formatInt(t.paid)} delta={<DeltaBadge current={t.paid} previous={pt?.paid} />} hint="Live-mode, non-founder" />
        <Kpi label="Visitor → paid" value={percent(t.paid, t.visitors)} delta={convNow !== null && convPrev !== null ? <DeltaBadge current={convNow * 100} previous={convPrev * 100} unit="pt" /> : null} hint="Go at ≥3%" />
        <Kpi label="Median visit → paid" value={formatDuration(c.medianPaidSeconds)} hint={c.paidSamples ? `${c.paidSamples} paid with a linked visit` : "No paid visit linked yet"} />
        <Kpi label="Live now" value={formatInt(live.sessions)} hint="Visits in the last 30 min" />
      </section>

      <SourcesSection data={data.sources} range={range} />

      {live.sessions > 0 ? (
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>Live now</h2><span className={styles.muted}>{live.sessions} {live.sessions === 1 ? "visit" : "visits"} in the last 30 minutes</span></div>
          <div className={styles.chips}>
            {live.byChannel.map((x) => <span key={`c-${x.key}`} className={styles.chip}>{x.key} · {x.count}</span>)}
            {live.byLanding.map((x) => <span key={`l-${x.key}`} className={`${styles.chip} ${styles.chipAlt}`}>{x.key} · {x.count}</span>)}
          </div>
        </section>
      ) : null}

      <section className={styles.card}>
        <div className={styles.cardHead}><h2>Visitors by channel</h2><span className={styles.muted}>{c.stacked.bucketMs === 3_600_000 ? "per hour" : "per day"}</span></div>
        <StackedChart series={c.stacked} />
      </section>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>Where visitors drop off</h2></div>
          <DropoffFunnel totals={t} />
          <p className={styles.sub}>Checkouts and paid come from reservations (same as Overview), so they can include people whose visit predates tracking.</p>
        </section>
        <DimTable title="Channels" dimension="Source" rows={c.channels} full note="Every step of the funnel per source." />
      </div>

      <div className={styles.grid2}>
        <DimTable title="Landing pages" dimension="Path" rows={c.landing} />
        <DimTable title="Devices" dimension="Device" rows={c.devices} />
      </div>

      <DimTable
        title="Countries"
        dimension="Country"
        rows={c.countries}
        note={data.hasCountry ? undefined : "No country yet: the proxy in front of the app does not send a geo header (cf-ipcountry or x-vercel-ip-country). It fills in if the site goes behind Cloudflare."}
      />
    </>
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
