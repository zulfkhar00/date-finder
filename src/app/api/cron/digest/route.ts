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
  const [views24, viewsAll, started24, startedAll, completed24, completedAll, paid24, paidAll] = await Promise.all([
    countEvents(supabase, "page_view", since), countEvents(supabase, "page_view"),
    countEvents(supabase, "reserve_start", since), countEvents(supabase, "reserve_start"),
    countReservations(supabase, since), countReservations(supabase),
    countPaid(supabase, since), countPaid(supabase)
  ]);

  const show = (value: number | null) => (value === null ? "n/a" : String(value));
  const line = (label: string, day: number | null, all: number | null) => `${label}: ${show(day)} (total ${show(all)})`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" }).format(now);
  const text = [
    `📊 Daily digest, ${date} (last 24h)`,
    line("Page views", views24, viewsAll),
    line("Signups started", started24, startedAll),
    line("Signups completed", completed24, completedAll),
    line("Paid $1", paid24, paidAll)
  ].join("\n");

  const sent = await sendOps("traffic", text);
  return NextResponse.json({ sent }, { headers: { "Cache-Control": "no-store" } });
}
