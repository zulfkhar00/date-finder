import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sweepKits } from "@/lib/operator/auto-kit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Automatic account kit for paid clients who are setting up and have none yet (the backfill, and the retry for anything the
// payment / onboarding hooks missed). Idempotent: an existing kit is never touched. Same auth as /api/cron/fulfilment
// (CRON_SECRET from Vercel cron, or STARTER_PACK_SWEEP_TOKEN from our own server). Counts only in the response; sends nothing to anyone.
//   GET /api/cron/auto-kit              up to 20 clients (?limit=1..50)

function matches(header: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = new TextEncoder().encode(header);
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  if (!matches(header, process.env.CRON_SECRET) && !matches(header, process.env.STARTER_PACK_SWEEP_TOKEN)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = Number.parseInt(new URL(request.url).searchParams.get("limit") ?? "20", 10) || 20;
  try {
    return NextResponse.json(await sweepKits(getSupabaseAdmin(), { limit }), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
