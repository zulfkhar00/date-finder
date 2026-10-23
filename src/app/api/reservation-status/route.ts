import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId || !/^cs_(test_|live_)[A-Za-z0-9]{10,}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid reservation link" }, { status: 400 });
  }
  try {
    const { data, error } = await getSupabaseAdmin().from("reservations").select("status, queue_position").eq("stripe_checkout_session_id", sessionId).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    return NextResponse.json({ status: data.status, position: data.status === "paid" ? data.queue_position : null }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load reservation status" }, { status: 500 });
  }
}
