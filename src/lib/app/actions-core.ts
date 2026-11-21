import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { internalEmailReason } from "@/lib/internal-traffic";
import { firstTouchColumns, FIRST_TOUCH_COOKIE, parseFirstTouch } from "@/lib/traffic";

/** First touch of the signed-in browser (ns_ft cookie), as profile columns. Empty when there is none or no request context. */
async function firstTouchForProfile() {
  try {
    const jar = await cookies();
    const value = jar.get(FIRST_TOUCH_COOKIE)?.value;
    return firstTouchColumns(parseFirstTouch(value ? `${FIRST_TOUCH_COOKIE}=${encodeURIComponent(value)}` : null));
  } catch {
    return {};
  }
}

/** Creates the profile row on first sight. Our own and test addresses are flagged internal so the funnel skips them. */
export async function ensureProfile(sb: SupabaseClient, userId: string, email: string | undefined) {
  const { data } = await sb.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
  if (data) return;
  const row = { user_id: userId, internal: email ? internalEmailReason(email) !== null : false };
  const firstTouch = await firstTouchForProfile();
  // The first_touch_* columns come from 2026-11-21-first-touch.sql; before it is applied, fall back to the plain row.
  if (Object.keys(firstTouch).length > 0) {
    const { error } = await sb.from("profiles").insert({ ...row, ...firstTouch });
    if (!error) return;
  }
  await sb.from("profiles").insert(row);
}
