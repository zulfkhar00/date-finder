import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { internalEmailReason } from "@/lib/internal-traffic";

/** Creates the profile row on first sight. Our own and test addresses are flagged internal so the funnel skips them. */
export async function ensureProfile(sb: SupabaseClient, userId: string, email: string | undefined) {
  const { data } = await sb.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (data) return;
  await sb.from("profiles").insert({ user_id: userId, internal: email ? internalEmailReason(email) !== null : false });
}
