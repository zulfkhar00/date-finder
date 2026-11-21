// Reclassifies the last N days of funnel_events (default 30) as human / suspect / bot from stored fields only
// (device, country, referrer, utm, in-app source, event counts per session, any quality already stored).
// It never contacts a visitor or a third party; it reads and (with --apply) updates funnel_events.quality.
//
//   node --conditions=react-server --import tsx scripts/backfill-session-quality.ts            # dry run, read-only
//   node --conditions=react-server --import tsx scripts/backfill-session-quality.ts --apply    # write
//   ... --days 14                                                                               # other window
//
// Needs SUPABASE_URL and SUPABASE_SECRET_KEY (server-side env). --apply needs supabase/2026-11-22-session-quality.sql applied first.
// Only sessions that are suspect or bot are written, and only on rows whose stored quality is missing or lower;
// human sessions stay NULL (legacy = human). Row contents are never printed, only counts.
import { createClient } from "@supabase/supabase-js";
import { planBackfill, type QualityEvent } from "../src/lib/bot-quality";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const daysArg = args.indexOf("--days");
const days = daysArg >= 0 ? Number(args[daysArg + 1]) : 30;
if (!Number.isInteger(days) || days < 1 || days > 365) {
  console.error("--days must be a whole number from 1 to 365.");
  process.exit(2);
}
const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
const key = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY (server-side env) first.");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const PAGE = 1000;
const COLUMNS = "id, created_at, event, session_id, device, country, utm_source, referrer_host, landing_path";
const missingColumn = (e: { code?: string | null } | null) => e?.code === "42703" || e?.code === "PGRST204";

async function load(since: string): Promise<{ events: QualityEvent[]; hasQuality: boolean }> {
  for (const [columns, hasQuality] of [[`${COLUMNS}, in_app_source, quality`, true], [`${COLUMNS}, in_app_source`, false], [COLUMNS, false]] as const) {
    const events: QualityEvent[] = [];
    let failed: { code?: string | null } | null = null;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase.from("funnel_events").select(columns).gte("created_at", since).order("created_at", { ascending: true }).order("id", { ascending: true }).range(from, from + PAGE - 1);
      if (error) { failed = error; break; }
      events.push(...((data ?? []) as unknown as QualityEvent[]));
      if (!data || data.length < PAGE) break;
    }
    if (!failed) return { events, hasQuality };
    if (!missingColumn(failed)) throw new Error(`funnel_events read failed (${failed.code ?? "unknown"})`);
  }
  throw new Error("funnel_events has no readable columns");
}

async function main() {
  const now = Date.now();
  const since = new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
  const { events: all, hasQuality } = await load(since);
  // Our own probe sessions are test traffic and are left alone.
  const events = all.filter((e) => !(e.session_id ?? "").startsWith("00000000-"));
  const plan = planBackfill(events, now);

  console.log(`${apply ? "APPLY" : "DRY RUN (read-only)"}: last ${days} days, ${events.length} events, ${plan.sessions} sessions`);
  console.log(`quality column: ${hasQuality ? "present" : "missing (apply the migration before --apply)"}`);
  console.log(`human ${plan.byQuality.human}, suspect ${plan.byQuality.suspect}, bot ${plan.byQuality.bot}`);
  console.log(`page_view sessions: before ${plan.pageViewSessions.before} (device bot dropped) -> after ${plan.pageViewSessions.after} (human only)`);
  console.log("reasons:", JSON.stringify(plan.reasons));
  const topCountries = Object.entries(plan.countries).sort((a, b) => b[1].suspect + b[1].bot - (a[1].suspect + a[1].bot)).slice(0, 10);
  console.log("non-human by country:", JSON.stringify(Object.fromEntries(topCountries)));
  console.log(`sessions to write: ${plan.updates.length}`);

  if (!apply) { console.log("Nothing written. Re-run with --apply to write."); return; }
  if (!hasQuality) { console.error("The quality column does not exist. Apply supabase/2026-11-22-session-quality.sql first."); process.exit(1); }

  let written = 0;
  for (const level of ["suspect", "bot"] as const) {
    const ids = plan.updates.filter((u) => u.quality === level).map((u) => u.sessionId);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      // Never lower a label. A bot also gets device = 'bot' so every report drops it.
      const patch = level === "bot" ? { quality: level, device: "bot" } : { quality: level };
      const lower = level === "bot" ? "quality.is.null,quality.eq.human,quality.eq.suspect" : "quality.is.null,quality.eq.human";
      const { error } = await supabase.from("funnel_events").update(patch).in("session_id", chunk).gte("created_at", since).or(lower);
      if (error) { console.error(`Update failed (${error.code ?? "unknown"}); ${written} sessions written so far. Safe to re-run.`); process.exit(1); }
      written += chunk.length;
    }
  }
  console.log(`Wrote quality on ${written} sessions.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "backfill failed");
  process.exit(1);
});
