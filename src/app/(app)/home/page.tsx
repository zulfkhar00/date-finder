import { ResumeSlot } from "@/components/app/resume-slot";
import { HomeView } from "@/components/app/views";
import { getHome, getPhotos, getProfile, getSetupGaps, getStarterPack } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";
import { regenerationsLeft, schedulePackAfterOnboarding } from "@/lib/starter-pack/service";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const [profile, home, gaps, view, photos, regenLeft] = await Promise.all([
    getProfile(sb, user.id), getHome(sb), getSetupGaps(sb, user.id), getStarterPack(sb, user.id), getPhotos(sb),
    // The counter is a nicety: if it can't be read, show the button as available and let the server enforce the limit.
    regenerationsLeft(user.id).catch(() => 3)
  ]);
  // Self-healing: a visit with no pack (or one that is waiting or failed) nudges generation after the response. The
  // claim is a no-op while a worker holds the lease, the pack is ready, or it is queued behind the daily cap.
  if (profile?.onboarding_done_at && (!view || view.status === "pending" || view.status === "failed")) schedulePackAfterOnboarding(user.id);
  const photoUrls = Object.fromEntries(photos.map((p) => [p.id, p.url]));
  return (
    <>
      <ResumeSlot />
      <HomeView
        name={profile?.first_name ?? ""} apps={home.apps} chats={home.chats} upcoming={home.upcoming} needsYou={home.needsYou}
        matchesThisWeek={home.matchesThisWeek} gaps={gaps}
        pack={{ view, photoUrls, hasCity: Boolean(profile?.city), regenLeft }}
      />
    </>
  );
}
