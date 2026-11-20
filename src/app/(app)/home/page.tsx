import { ResumeSlot } from "@/components/app/resume-slot";
import { HomeView } from "@/components/app/views";
import { getHome, getPhotos, getProfile, getSetupGaps, getStarterPack } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";
import { regenerationsLeft } from "@/lib/starter-pack/service";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const [profile, home, gaps, view, photos, regenLeft] = await Promise.all([
    getProfile(sb, user.id), getHome(sb), getSetupGaps(sb, user.id), getStarterPack(sb, user.id), getPhotos(sb),
    // The counter is a nicety: if it can't be read, show the button as available and let the server enforce the limit.
    regenerationsLeft(user.id).catch(() => 3)
  ]);
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
