import "server-only";
import { cache } from "react";
import { getApps, getPrefs, getProfile } from "@/lib/app/data";
import { ageFromBirthday } from "@/lib/app/domain";
import type { ResumeData } from "@/lib/app/resume";
import { createAppClient, getAppUser } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * What the "finish setting up" card needs, or null when it must not show: signed out, not onboarded
 * (the app layout sends those to /onboarding), or already paid. Paid = a paid reservation under the account email.
 */
export const getActivation = cache(async (): Promise<ResumeData | null> => {
  const user = await getAppUser();
  if (!user?.email) return null;
  const email = user.email.toLowerCase();
  const sb = await createAppClient();
  const profile = await getProfile(sb, user.id);
  if (!profile?.onboarding_done_at) return null;
  const { data, error } = await getSupabaseAdmin().from("reservations").select("id").eq("email", email).eq("status", "paid").limit(1);
  if (error || (data?.length ?? 0) > 0) return null; // unknown state: never push a second payment
  const [prefs, apps] = await Promise.all([getPrefs(sb, user.id), getApps(sb)]);
  return {
    email, city: profile.city ?? "", interestedIn: profile.interested_in ?? [], lookingFor: prefs?.looking_for ?? null,
    name: profile.first_name ?? "", age: profile.birthday ? ageFromBirthday(profile.birthday) : null,
    apps: apps.map((a) => a.app), ageMin: prefs?.age_min ?? null, ageMax: prefs?.age_max ?? null, interests: profile.interests ?? []
  };
});
