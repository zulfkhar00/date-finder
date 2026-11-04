import { HomeView } from "@/components/app/views";
import { getHome, getProfile } from "@/lib/app/data";
import { createAppClient, requireUser } from "@/lib/app/session";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const [profile, home] = await Promise.all([getProfile(sb, user.id), getHome(sb)]);
  return <HomeView name={profile?.first_name ?? ""} apps={home.apps} chats={home.chats} upcoming={home.upcoming} needsYou={home.needsYou} matchesThisWeek={home.matchesThisWeek} />;
}
