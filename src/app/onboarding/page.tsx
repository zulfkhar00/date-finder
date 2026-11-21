import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { draftFrom } from "@/lib/app/draft";
import { ensureProfile } from "@/lib/app/actions-core";
import { getApps, getPhotos, getPrefs, getProfile } from "@/lib/app/data";
import { createAppClient, getAppUser } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CONSENT_STEP, PAY_STEP } from "@/lib/app/domain";
import { paidAccessFor } from "@/lib/paid-access";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
// The starter pack is written after the consent step responds (after() in giveConsent); give it room to finish.
export const maxDuration = 60; // Vercel Hobby ceiling; the pack runs the text and photo calls side by side to fit

export default async function OnboardingPage() {
  const user = await getAppUser();
  // Free sign-up works everywhere; only the pay step depends on the country (PAID_COUNTRIES, admin sessions override).
  const paidOffered = (await paidAccessFor()).allowed;
  // Not signed in yet: the first questions run without an account, and the email code comes after them.
  if (!user) return <OnboardingFlow key="guest" guest email="" draft={draftFrom(null, null, [])} photos={[]} startStep={0} paid={false} paidOffered={paidOffered} />;
  const admin = getSupabaseAdmin();
  await ensureProfile(admin, user.id, user.email);
  const sb = await createAppClient();
  const [profile, prefs, apps, photos] = await Promise.all([getProfile(sb, user.id), getPrefs(sb, user.id), getApps(sb), getPhotos(sb)]);
  const done = Boolean(profile?.onboarding_done_at);
  // Paid already (early-access reservation under this email)? Then the payment step is skipped.
  let paid = false;
  if (user.email) {
    const { data } = await admin.from("reservations").select("id").eq("email", user.email.toLowerCase()).eq("status", "paid").limit(1);
    paid = (data?.length ?? 0) > 0;
  }
  if (done && paid) redirect("/home");
  return (
    <OnboardingFlow
      key="member"
      guest={false}
      email={user.email ?? ""}
      draft={draftFrom(profile, prefs, apps.map((a) => a.app), apps)}
      photos={photos}
      startStep={done ? PAY_STEP : Math.min(profile?.onboarding_step ?? 0, CONSENT_STEP)}
      paid={paid}
      paidOffered={paidOffered}
    />
  );
}
