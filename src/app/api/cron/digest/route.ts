import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { reservationExclusion } from "@/lib/internal-traffic";
import { getRealFunnel, type RealFunnel } from "@/lib/real-funnel";
import { sendOps } from "@/lib/ops-notify";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily ops digest into the TRAFFIC topic at 09:00 Pacific. Vercel cron calls this at 16:00 and
// 17:00 UTC (vercel.json); only the call that lands in the 9 o'clock Pacific hour posts, so DST
// needs no edits. `?force=1` posts regardless of the hour (still needs CRON_SECRET).
// Counts come only from our own tables (funnel_events, reservations) via getRealFunnel, which drops
// founders, test emails, Stripe test-mode checkouts and probe sessions. Never raw table counts.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function pacificHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", hourCycle: "h23" }).format(now));
}

type Supabase = ReturnType<typeof getSupabaseAdmin>;

// Top `ref` values (IG reel ids) among REAL paid reservations in the window. Null when the column is missing.
async function topPaidRefs(supabase: Supabase, since: string): Promise<string | null> {
  const { data, error } = await supabase.from("reservations").select("ref, email, stripe_checkout_session_id").eq("status", "paid").gte("paid_at", since).not("ref", "is", null).limit(1000);
  if (error) return null;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { ref: string; email: string; stripe_checkout_session_id: string | null }[]) {
    if (reservationExclusion(row)) continue;
    counts.set(row.ref, (counts.get(row.ref) ?? 0) + 1);
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return top.length ? top.map(([ref, n]) => `${ref} ${n}`).join(", ") : "none";
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && pacificHour(now) !== 9) return NextResponse.json({ skipped: "not 09:00 Pacific" });

  let supabase: Supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const [day, month, refs] = await Promise.all([
    getRealFunnel(supabase, 1, now).catch(() => null),
    getRealFunnel(supabase, 30, now).catch(() => null),
    topPaidRefs(supabase, since)
  ]);

  const show = (value: number | undefined) => (value === undefined ? "n/a" : String(value));
  const line = (label: string, pick: (f: RealFunnel) => number) => `${label}: ${show(day ? pick(day) : undefined)} (30d ${show(month ? pick(month) : undefined)})`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" }).format(now);
  const ex = month?.excluded;
  const text = [
    `📊 Daily digest, ${date} (last 24h, real traffic only)`,
    line("Page views (visitors)", (f) => f.visitors),
    line("Get started clicks", (f) => f.getStarted),
    line("Onboarding opened", (f) => f.reserveStarts),
    line("Onboarding done", (f) => f.onboardingComplete),
    line("Checkout opened", (f) => f.checkouts),
    line("Paid $1", (f) => f.paid),
    `Paid by ref: ${refs ?? "n/a"}`,
    ex ? `Excluded (30d): ${ex.founder} founder, ${ex.test_email} test email, ${ex.stripe_test} Stripe test checkouts, ${ex.internalSessions} internal sessions` : "Excluded: n/a"
  ].join("\n");

  const sent = await sendOps("traffic", text);
  return NextResponse.json({ sent }, { headers: { "Cache-Control": "no-store" } });
}
