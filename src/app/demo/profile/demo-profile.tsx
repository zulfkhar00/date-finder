"use client";

import { ProfileClient, type ProfileApi } from "@/components/app/profile-client";
import type { Photo } from "@/lib/app/data";
import type { AppAccountRow } from "@/lib/app/domain";
import type { Draft } from "@/lib/app/draft";

const ok = async () => ({ ok: true as const });
const demoApi: ProfileApi = {
  saveStep: ok, setAppPaused: ok, saveSettings: ok,
  deleteAccount: async () => ({ ok: false as const, error: "This is a demo. Nothing to delete." }),
  signOut: async () => {},
  photos: { remove: ok, reorder: ok, upload: async () => { throw new Error("Photo upload is off in the demo."); } }
};

/** The real profile screen with sample data and stubbed saves. */
export function DemoProfile({ draft, photos, apps, age }: { draft: Draft; photos: Photo[]; apps: AppAccountRow[]; age: number }) {
  return <ProfileClient email="alex@example.com" age={age} draft={draft} photos={photos} apps={apps} voice="warm" notifyEmail api={demoApi} />;
}
