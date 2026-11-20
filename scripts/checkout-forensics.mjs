#!/usr/bin/env node
// Read-only backfill: why did past checkouts not pay? Lists the Checkout Sessions of the last N days
// (default 30) with their status and, for the ones that did not pay, the PaymentIntent's last payment
// error (code, decline_code, type) and the card's brand, country and funding. Only list/read calls: it
// cannot create, change, refund or charge anything.
//
//   STRIPE_SECRET_KEY=sk_live_... node scripts/checkout-forensics.mjs [--days 30] [--json]
//   (a restricted key with read access to Checkout Sessions and PaymentIntents is enough)
//
// Privacy: no emails, names, addresses or card numbers are printed. Session ids are shortened to the
// last 8 characters; the card country/brand are issuer-level facts, not personal data.
import Stripe from "stripe";

const DAY = 86_400;

/** One row per Checkout Session. `session` may carry an expanded `payment_intent`. Pure, exported for tests. */
export function summarizeSession(session) {
  const intent = session.payment_intent && typeof session.payment_intent === "object" ? session.payment_intent : null;
  const error = intent?.last_payment_error ?? null;
  const method = error?.payment_method ?? null;
  const card = method?.card ?? null;
  return {
    session: `…${String(session.id).slice(-8)}`,
    created: new Date(session.created * 1000).toISOString(),
    mode: session.livemode ? "live" : "test",
    status: session.status ?? null, // open | complete | expired
    payment_status: session.payment_status ?? null, // paid | unpaid | no_payment_required
    intent_status: intent?.status ?? null,
    error_type: error?.type ?? null,
    code: error?.code ?? null,
    decline_code: error?.decline_code ?? null,
    payment_method: method?.type ?? null,
    card_brand: card?.brand ?? null,
    card_country: card?.country ?? null,
    funding: card?.funding ?? null
  };
}

/** What happened to a session, in one word: paid | failed | expired | abandoned (open, never paid). */
export function outcomeOf(row) {
  if (row.payment_status === "paid") return "paid";
  if (row.code || row.error_type) return "failed";
  if (row.status === "expired") return "expired";
  return "abandoned";
}

/** Counts per outcome and per failure reason (code / decline_code) and card country. Pure, exported for tests. */
export function aggregate(rows) {
  const outcomes = {};
  const reasons = {};
  const cardCountries = {};
  for (const row of rows) {
    const outcome = outcomeOf(row);
    outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    if (outcome === "failed") {
      const reason = row.decline_code ? `${row.code ?? "unknown"} / ${row.decline_code}` : (row.code ?? row.error_type ?? "unknown");
      reasons[reason] = (reasons[reason] ?? 0) + 1;
      const country = row.card_country ?? "unknown";
      cardCountries[country] = (cardCountries[country] ?? 0) + 1;
    }
  }
  return { total: rows.length, outcomes, reasons, cardCountries };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("Set STRIPE_SECRET_KEY (read access is enough). Nothing was called.");
    process.exit(2);
  }
  const args = process.argv.slice(2);
  const daysIndex = args.indexOf("--days");
  const days = daysIndex >= 0 ? Number(args[daysIndex + 1]) : 30;
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    console.error("--days must be between 1 and 365");
    process.exit(2);
  }
  const stripe = new Stripe(key);
  const since = Math.floor(Date.now() / 1000) - days * DAY;

  const rows = [];
  // expand: the PaymentIntent (last_payment_error with its payment_method inline) comes in the same call.
  for await (const session of stripe.checkout.sessions.list({ created: { gte: since }, limit: 100, expand: ["data.payment_intent"] })) {
    rows.push(summarizeSession(session));
  }
  rows.sort((a, b) => (a.created < b.created ? -1 : 1));

  if (args.includes("--json")) {
    console.log(JSON.stringify({ days, rows, summary: aggregate(rows) }, null, 2));
    return;
  }
  console.table(rows.map((r) => ({ ...r, outcome: outcomeOf(r) })));
  const summary = aggregate(rows);
  console.log(`\nLast ${days} days: ${summary.total} checkout sessions`);
  console.log("Outcomes:", summary.outcomes);
  console.log("Failure reasons:", summary.reasons);
  console.log("Card country of failures:", summary.cardCountries);
  console.log("\nNote: a session that never reached the payment step has no PaymentIntent error and shows as abandoned or expired.");
}

import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("checkout-forensics failed:", error instanceof Error ? error.message : "unknown error");
    process.exit(1);
  });
}
