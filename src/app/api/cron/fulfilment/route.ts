import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runFulfilmentSweep } from "@/lib/fulfilment/service";
import { reconcileChecklists } from "@/lib/operator/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fulfilment SLA alert: one ops line per PAID client who has waited more than 24 h with no status change (at most one per
// client per UTC day), and one per paid client still setting up 48 h after activation (one per 48 h window); both claimed in the database. Same auth as /api/cron/report-sla. Schedule it from a founders' server, e.g.
//   */30 * * * * curl -fsS -H "Authorization: Bearer $STARTER_PACK_SWEEP_TOKEN" https://noswipe.app/api/cron/fulfilment
// Responses carry counts only. Sends nothing to clients.

function matches(header: string, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = new TextEncoder().encode(header);
  const expected = new TextEncoder().encode(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function authorized(request: Request): boolean {
  const header = request.headers.get("authorization") ?? "";
  return matches(header, process.env.CRON_SECRET) || matches(header, process.env.STARTER_PACK_SWEEP_TOKEN);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // First activate apps whose checklist is complete (a client who resumed after pausing mid-setup), so they are not alerted as stuck.
    const activated = await reconcileChecklists(getSupabaseAdmin()).catch(() => 0);
    return NextResponse.json({ ...(await runFulfilmentSweep()), activated });
  } catch {
    return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });
  }
}
