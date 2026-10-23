import { NextResponse, type NextRequest } from "next/server";
import { adminEmailOrNull } from "../../_lib/auth";
import { exportLeads, parseLeadFilters, type LeadWithStage } from "../../_lib/data";
import { toCsv } from "../../_lib/csv";

export const runtime = "nodejs";

const COLUMNS = [
  "created_at",
  "email",
  "city",
  "dating_preference",
  "relationship_goal",
  "date_frequency",
  "status",
  "queue_position",
  "paid_at",
  "variant",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "referrer",
  "stage",
  "id"
] as const satisfies readonly (keyof LeadWithStage)[];

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };

// Admin-only CSV of reservations, honoring the same filters as /admin/leads.
// Anyone not signed in as an ADMIN_EMAILS address gets a plain 404.
export async function GET(request: NextRequest) {
  if (!(await adminEmailOrNull())) return new NextResponse("Not found", { status: 404, headers: PRIVATE_HEADERS });

  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const { page: _page, ...filters } = parseLeadFilters(params);
  void _page;
  let rows: LeadWithStage[];
  try {
    rows = await exportLeads(filters);
  } catch {
    return new NextResponse("Export failed. Check the server log for the error code.", { status: 500, headers: PRIVATE_HEADERS });
  }

  const csv = toCsv<LeadWithStage>(COLUMNS, rows.map((row) => ({ ...row, variant: row.variant ?? "premium" })));
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}`, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="noswipe-leads-${stamp}.csv"`
    }
  });
}
