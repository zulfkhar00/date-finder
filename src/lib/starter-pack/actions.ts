"use server";

import { revalidatePath } from "next/cache";
import { userOrNull } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { startRegeneration } from "./service";

export type RegenerateResult = { ok: true } | { ok: false; error: string };

const MESSAGES = {
  unconfigured: "Your pack can't be refreshed right now. Try again later.",
  limit: "You've used today's refreshes. Try again tomorrow.",
  busy: "Your pack is already being written.",
  cap: "We're at capacity today. Your pack will be refreshed tomorrow, nothing to do.",
  unavailable: "Couldn't start that. Try again in a minute."
} as const;

/** The Regenerate button: signed-in user only, 3 per UTC day, one run at a time. */
export async function regeneratePack(): Promise<RegenerateResult> {
  const user = await userOrNull();
  if (!user) return { ok: false, error: "Your session ended. Sign in again." };
  const { data: profile } = await getSupabaseAdmin().from("profiles").select("onboarding_done_at").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_done_at) return { ok: false, error: "Finish setting up your profile first." };
  const started = await startRegeneration(user.id, "regenerate");
  if (!started.ok) return { ok: false, error: MESSAGES[started.reason] };
  revalidatePath("/home");
  return { ok: true };
}
