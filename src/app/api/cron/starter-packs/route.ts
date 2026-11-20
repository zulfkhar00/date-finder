import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generatePackFor, sweepFlags, sweepPacks } from "@/lib/starter-pack/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel Hobby ceiling; one pack takes about 20-40 s, so a call sweeps one to two users

// Retry sweep for "Your starter pack". Vercel cron runs it daily (vercel.json, Hobby limit); the primary path is the
// generation that starts when onboarding finishes. Call it every 10 minutes from our own server with STARTER_PACK_SWEEP_TOKEN.
// It generates a pack for every onboarded user who has none yet (this is also the backfill for users who finished onboarding before the feature existed), retries
// packs that failed an hour ago, and picks up packs that were queued behind the daily cap once a new UTC day starts.
// Protected by CRON_SECRET or STARTER_PACK_SWEEP_TOKEN. Responses carry counts only, never user data.
//
//   GET /api/cron/starter-packs                      sweep, up to 5 users (?limit=1..10)
//   GET /api/cron/starter-packs?flags=1              photo safety-flag pass over existing photos, up to 3 users (?limit=1..6)
//   GET /api/cron/starter-packs?userId=<uuid>        generate for one user now (kind "admin": ignores the regenerate limit)
// Both honour the daily run and token caps (STARTER_PACK_DAILY_CAP, STARTER_PACK_DAILY_TOKEN_CAP).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function matches(header: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = new TextEncoder().encode(header);
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// CRON_SECRET is what Vercel cron sends. STARTER_PACK_SWEEP_TOKEN (optional) is a second bearer for a sweep driven from
// our own server every 10 minutes, because Vercel Hobby only runs crons daily. Both are compared in constant time.
function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  const byCron = matches(header, process.env.CRON_SECRET);
  const byToken = matches(header, process.env.STARTER_PACK_SWEEP_TOKEN);
  return byCron || byToken;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const headers = { "Cache-Control": "no-store" };
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  try {
    if (userId) {
      if (!UUID.test(userId)) return NextResponse.json({ error: "Bad userId" }, { status: 400, headers });
      return NextResponse.json({ result: await generatePackFor(userId, "admin") }, { headers });
    }
    if (url.searchParams.get("flags") === "1") {
      const flagLimit = Math.min(6, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "3", 10) || 3));
      return NextResponse.json(await sweepFlags(flagLimit), { headers });
    }
    const limit = Math.min(10, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));
    return NextResponse.json(await sweepPacks({ limit }), { headers });
  } catch {
    return NextResponse.json({ error: "Sweep failed" }, { status: 500, headers });
  }
}
