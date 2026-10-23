import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Real, live-mode paid waitlist places. Test-mode Checkout sessions (cs_test_) are excluded so
 * the public number never includes our own 4242 test payments. Returns null when Supabase isn't
 * configured (e.g. during the Docker build) or the query fails; callers then render nothing.
 */
export async function getLivePaidCount(): Promise<number | null> {
  try {
    const { count, error } = await getSupabaseAdmin()
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "paid")
      .like("stripe_checkout_session_id", "cs_live_%");
    if (error || typeof count !== "number") return null;
    return count;
  } catch {
    return null;
  }
}

/** Below this the counter stays hidden and the founding-members copy stands on its own. */
export const PUBLIC_COUNT_MIN = 10;
