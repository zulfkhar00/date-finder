import { ResumeSlot } from "@/components/app/resume-slot";
import { getApps, getPhotos, getPrefs, getProfile } from "@/lib/app/data";
import { APPS, ageFromBirthday } from "@/lib/app/domain";
import { flaggedPhotoIds } from "@/lib/starter-pack/photo-flags";
import { createAppClient, requireUser } from "@/lib/app/session";
import { draftFrom } from "@/lib/app/draft";
import { ProfileClient } from "@/components/app/profile-client";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  const sb = await createAppClient();
  const [profile, prefs, apps, photos, flagged] = await Promise.all([getProfile(sb, user.id), getPrefs(sb, user.id), getApps(sb), getPhotos(sb), flaggedPhotoIds(user.id).catch(() => new Set<string>())]);
  const ordered = APPS.flatMap((a) => apps.filter((x) => x.app === a));
  return (
    <>
    <ResumeSlot />
    <ProfileClient
      email={user.email ?? ""}
      age={profile?.birthday ? ageFromBirthday(profile.birthday) : null}
      draft={draftFrom(profile, prefs, ordered.map((a) => a.app), ordered)}
      photos={photos}
      flaggedPhotoIds={photos.filter((p) => flagged.has(p.id)).map((p) => p.id)}
      apps={ordered}
      voice={profile?.voice ?? "warm"}
      notifyEmail={profile?.notify_email ?? true}
    />
    </>
  );
}
