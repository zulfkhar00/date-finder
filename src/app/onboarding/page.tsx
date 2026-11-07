import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { draftFrom } from "@/lib/app/draft";
import { ensureProfile } from "@/lib/app/actions-core";
import { getApps, getPhotos, getPrefs, getProfile } from "@/lib/app/data";
import { createAppClient, getAppUser } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getAppUser();
  // Not signed in yet: the first questions run without an account, and the email code comes after them.
  if (!user) return <OnboardingFlow key="guest" guest email="" draft={draftFrom(null, null, [])} photos={[]} startStep={0} paid={false} />;
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
      draft={draftFrom(profile, prefs, apps.map((a) => a.app))}
      photos={photos}
      startStep={done ? 8 : Math.min(profile?.onboarding_step ?? 0, 7)}
      paid={paid}
    />
  );
}
