// Photo safety flags: what the vision call may report per photo, how its answer is parsed, and the plain wording
// shown to the user and to the admin. Pure (no I/O, no "server-only") so `npm test` imports it directly.
//
// The flags only ever route a photo to a human. They never block an account, never message anyone, and the user is
// told one neutral sentence: nothing about which rule or what the photo shows. Nothing here logs.
import { extractJson } from "./validate";

export const FLAG_KINDS = ["explicit_or_sexual", "possible_minor", "not_a_real_person_or_not_the_user", "violence_or_weapons"] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

/** Admin-only wording (the user never sees these). */
export const FLAG_LABELS: Record<FlagKind, string> = {
  explicit_or_sexual: "Explicit or sexual",
  possible_minor: "Possibly a minor",
  not_a_real_person_or_not_the_user: "Not a real person, or not the user (celebrity, stock photo, screenshot, art)",
  violence_or_weapons: "Violence or weapons"
};

/** The only thing the user is told. No reason, no accusation. */
export const USER_FLAG_NOTICE = "One photo can’t be used — please upload a different one.";

export type FlagStatus = "clear" | "flagged" | "approved" | "removed";

/** One photo's verdict from a model call. `flags` empty = checked and fine. */
export type PhotoVerdict = { photoId: string; flags: FlagKind[] };

export function isFlagKind(value: unknown): value is FlagKind {
  return typeof value === "string" && (FLAG_KINDS as readonly string[]).includes(value);
}

/**
 * Reads the per-photo `flags` out of the vision call's JSON. The answer is a `ranking` array (the starter pack call) or a
 * `photos` array (the flag-only sweep call); each item is {photo: <1-based number>, flags: [<kind>, ...]}.
 *
 * Leniency is deliberate and one-directional: anything unusable (not JSON, no array, an unknown photo number, an
 * unknown kind, flags that are not an array) is treated as NOT flagged, because a parsing slip must never accuse a
 * user. A photo the model did not mention is simply absent from the result (not reviewed), so the sweep tries it
 * again. Returns null when the whole answer was unusable, so the caller can log a code.
 */
export function parsePhotoFlags(raw: string, photos: readonly { id: string }[]): PhotoVerdict[] | null {
  const json = extractJson(raw) as { ranking?: unknown; photos?: unknown } | null;
  const items = Array.isArray(json?.ranking) ? json.ranking : Array.isArray(json?.photos) ? json.photos : null;
  if (!items) return null;
  const seen = new Set<number>();
  const verdicts: PhotoVerdict[] = [];
  for (const item of items as { photo?: unknown; flags?: unknown }[]) {
    const n = Number(item?.photo);
    if (!Number.isInteger(n) || n < 1 || n > photos.length || seen.has(n)) continue;
    seen.add(n);
    const given = Array.isArray(item.flags) ? item.flags : [];
    const flags = [...new Set(given.filter(isFlagKind))];
    verdicts.push({ photoId: photos[n - 1].id, flags });
  }
  return verdicts;
}

/** Ids of photos the model flagged, minus any a person already approved. */
export function flaggedIds(verdicts: readonly PhotoVerdict[] | null, approved: ReadonlySet<string> = new Set()): Set<string> {
  return new Set((verdicts ?? []).filter((v) => v.flags.length > 0 && !approved.has(v.photoId)).map((v) => v.photoId));
}

export function flagLabel(flags: readonly string[]): string {
  const known = flags.filter(isFlagKind).map((f) => FLAG_LABELS[f]);
  return known.length ? known.join("; ") : "Flagged";
}
