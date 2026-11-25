// Feeds the funnel rows the mock stack captured through the dashboard's own computeRealFunnel,
// to show whether a completed test checkout is counted as real traffic.
import { computeRealFunnel } from "@/lib/real-funnel";
async function main() {
const state = await (await fetch("http://127.0.0.1:54399/__state")).json();
const rows = state.db.funnel_events.map((e: Record<string, string>, i: number) => ({ id: i, created_at: e.created_at, event: e.event, session_id: e.session_id, variant: e.variant, utm_campaign: e.utm_campaign, dedupe_key: e.dedupe_key }));
const full = computeRealFunnel(rows, state.db.reservations, null);
// Same sessions but with the checkout/paid rows removed: an abandoned test run.
const abandoned = computeRealFunnel(rows.filter((r: { event: string }) => !["checkout_created", "paid"].includes(r.event)), [], null);
const pick = (f: typeof full) => ({ visitors: f.visitors, reserveStarts: f.reserveStarts, onboardingComplete: f.onboardingComplete, checkouts: f.checkouts, paid: f.paid, excluded: f.excluded });
console.log(JSON.stringify({ completedTestCheckout: pick(full), sameSessionsIfAbandonedBeforeCheckout: pick(abandoned) }, null, 1));
}
void main();
