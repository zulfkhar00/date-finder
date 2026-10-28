import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendOps } from "@/lib/ops-notify";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily ops digest into the TRAFFIC topic at 09:00 Pacific. Vercel cron calls this at 16:00 and
// 17:00 UTC (vercel.json); only the call that lands in the 9 o'clock Pacific hour posts, so DST
// needs no edits. `?force=1` posts regardless of the hour (still needs CRON_SECRET).
// Counts come only from our own tables: funnel_events (first-party tracker) and reservations.

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

async function countEvents(supabase: Supabase, event: string, since?: string): Promise<number | null> {
  let query = supabase.from("funnel_events").select("id", { count: "exact", head: true }).eq("event", event);
  if (since) query = query.gte("created_at", since);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

async function countReservations(supabase: Supabase, since?: string): Promise<number | null> {
  let query = supabase.from("reservations").select("id", { count: "exact", head: true });
  if (since) query = query.gte("created_at", since);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

async function countPaid(supabase: Supabase, since?: string): Promise<number | null> {
  let query = supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "paid");
  if (since) query = query.gte("paid_at", since);
  const { count, error } = await query;
  return error ? null : (count ?? 0);
}

// Top `ref` values (IG reel ids) among paid reservations in the window. Null when the column is missing.
async function topPaidRefs(supabase: Supabase, since: string): Promise<string | null> {
  const { data, error } = await supabase.from("reservations").select("ref").eq("status", "paid").gte("paid_at", since).not("ref", "is", null).limit(1000);
  if (error) return null;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { ref: string }[]) counts.set(row.ref, (counts.get(row.ref) ?? 0) + 1);
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
  const [views24, viewsAll, get24, getAll, started24, startedAll, done24, doneAll, checkout24, checkoutAll, paid24, paidAll, refs] = await Promise.all([
    countEvents(supabase, "page_view", since), countEvents(supabase, "page_view"),
    countEvents(supabase, "get_started", since), countEvents(supabase, "get_started"),
    countEvents(supabase, "reserve_start", since), countEvents(supabase, "reserve_start"),
    countEvents(supabase, "onboarding_complete", since), countEvents(supabase, "onboarding_complete"),
    countReservations(supabase, since), countReservations(supabase),
    countPaid(supabase, since), countPaid(supabase),
    topPaidRefs(supabase, since)
  ]);

  const show = (value: number | null) => (value === null ? "n/a" : String(value));
  const line = (label: string, day: number | null, all: number | null) => `${label}: ${show(day)} (total ${show(all)})`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" }).format(now);
  const text = [
    `📊 Daily digest, ${date} (last 24h)`,
    line("Page views", views24, viewsAll),
    line("Get started clicks", get24, getAll),
    line("Onboarding opened", started24, startedAll),
    line("Onboarding done", done24, doneAll),
    line("Checkout opened", checkout24, checkoutAll),
    line("Paid $1", paid24, paidAll),
    `Paid by ref: ${refs ?? "n/a"}`
  ].join("\n");

  const sent = await sendOps("traffic", text);
  return NextResponse.json({ sent }, { headers: { "Cache-Control": "no-store" } });
}
