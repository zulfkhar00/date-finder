import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { generatePackFor, sweepPacks } from "@/lib/starter-pack/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Retry sweep for "Your starter pack", every 10 minutes (vercel.json). It generates a pack for every onboarded user
// who has none yet (this is also the backfill for users who finished onboarding before the feature existed), retries
// packs that failed an hour ago, and picks up packs that were queued behind the daily cap once a new UTC day starts.
// Protected by CRON_SECRET, like /api/cron/digest. Responses carry counts only, never user data.
//
//   GET /api/cron/starter-packs                      sweep, up to 5 users (?limit=1..10)
//   GET /api/cron/starter-packs?userId=<uuid>        generate for one user now (kind "admin": ignores the regenerate limit)
// Both honour the daily run and token caps (STARTER_PACK_DAILY_CAP, STARTER_PACK_DAILY_TOKEN_CAP).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
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
    const limit = Math.min(10, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "5", 10) || 5));
    return NextResponse.json(await sweepPacks({ limit }), { headers });
  } catch {
    return NextResponse.json({ error: "Sweep failed" }, { status: 500, headers });
  }
}
