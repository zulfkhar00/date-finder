import { NextResponse } from "next/server";
import { errorMessage, notifyOpsError } from "@/lib/ops-notify";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_(test_|live_)[A-Za-z0-9]{10,}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid reservation link" }, { status: 400 });
  }
  try {
    const { data, error } = await getSupabaseAdmin().from("reservations").select("status").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    return NextResponse.json({ status: data.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    notifyOpsError("GET /api/reservation-status 500", errorMessage(error));
    return NextResponse.json({ error: "Unable to load reservation status" }, { status: 500 });
  }
}
