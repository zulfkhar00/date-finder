// Draft of the onboarding/profile answers as form strings, plus the mapping to what the server validates.
import type { PrefRow, ProfileRow } from "@/lib/app/data";
import { APPS, type App, type StepName } from "@/lib/app/domain";

export type Draft = {
  firstName: string; birthday: string; gender: string; interestedIn: string[];
  job: string; heightCm: string; interests: string[];
  city: string; ageMin: string; ageMax: string; distanceKm: string; lookingFor: string; dealbreakers: string[];
  apps: App[];
};

export function draftFrom(profile: ProfileRow | null, prefs: PrefRow | null, apps: string[]): Draft {
  const three = (list: string[] | undefined) => [list?.[0] ?? "", list?.[1] ?? "", list?.[2] ?? ""];
  return {
    firstName: profile?.first_name ?? "", birthday: profile?.birthday ?? "", gender: profile?.gender ?? "", interestedIn: profile?.interested_in ?? [],
    job: profile?.job ?? "", heightCm: profile?.height_cm ? String(profile.height_cm) : "", interests: three(profile?.interests),
    city: profile?.city ?? "", ageMin: prefs?.age_min ? String(prefs.age_min) : "", ageMax: prefs?.age_max ? String(prefs.age_max) : "",
    distanceKm: prefs?.distance_km ? String(prefs.distance_km) : "50", lookingFor: prefs?.looking_for ?? "", dealbreakers: three(prefs?.dealbreakers),
    apps: apps.filter((a): a is App => (APPS as readonly string[]).includes(a))
  };
}

const num = (v: string) => (v.trim() === "" ? null : Number(v));
const clean = (list: string[]) => list.map((s) => s.trim()).filter(Boolean);

/** What the server action validates for each step. */
export function payloadFor(step: StepName, d: Draft): unknown {
  switch (step) {
    case "name": return { firstName: d.firstName };
    case "birthday": return { birthday: d.birthday };
    case "who": return { gender: d.gender, interestedIn: d.interestedIn };
    case "about": return { job: d.job, heightCm: d.heightCm.trim() === "" ? null : num(d.heightCm), interests: clean(d.interests) };
    case "type": return { city: d.city, ageMin: num(d.ageMin), ageMax: num(d.ageMax), distanceKm: num(d.distanceKm), lookingFor: d.lookingFor, dealbreakers: clean(d.dealbreakers) };
    case "apps": return { apps: d.apps };
  }
}

