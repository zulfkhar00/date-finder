import { getApps, getPhotos, getPrefs, getProfile } from "@/lib/app/data";
import { APPS, ageFromBirthday } from "@/lib/app/domain";
import { createAppClient, requireUser } from "@/lib/app/session";
import { draftFrom } from "@/lib/app/draft";
import { ProfileClient } from "@/components/app/profile-client";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const [profile, prefs, apps, photos] = await Promise.all([getProfile(sb, user.id), getPrefs(sb, user.id), getApps(sb), getPhotos(sb)]);
  const ordered = APPS.flatMap((a) => apps.filter((x) => x.app === a));
  return (
    <ProfileClient
      email={user.email ?? ""}
      age={profile?.birthday ? ageFromBirthday(profile.birthday) : null}
      draft={draftFrom(profile, prefs, ordered.map((a) => a.app))}
      photos={photos}
      apps={ordered}
      voice={profile?.voice ?? "warm"}
      notifyEmail={profile?.notify_email ?? true}
    />
  );
}
