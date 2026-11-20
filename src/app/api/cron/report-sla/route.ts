import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runSlaSweep } from "@/lib/reports/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SLA breach sweep for the takedown queue: one ops line per breach, once (claimed in the database). Vercel Hobby cron runs at most daily
// (vercel.json); for 10-minute coverage a founders' server calls it: */10 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://noswipe.app/api/cron/report-sla
// The admin queue page also runs the same sweep when opened. Responses carry counts only.

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = new TextEncoder().encode(request.headers.get("authorization") ?? "");
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runSlaSweep());
  } catch {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }
}
