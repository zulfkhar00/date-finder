// Pure helpers for the onboarding screen: no I/O, so scripts/check-app.ts can run them directly.
import { ageFromBirthday } from "@/lib/app/domain";
import type { Draft } from "@/lib/app/draft";

export const NETWORK_ERROR = "Couldn't reach NoSwipe. Check your connection and try again.";
/** A save that takes longer than this is treated as a dropped connection instead of spinning forever. */
export const ACTION_TIMEOUT_MS = 20_000;

/** Rejects with a timeout error when the promise has not settled in `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms = ACTION_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Age sent with the reservation: whole years from the birthday (month and day count), 18 to 99, or undefined when blank. */
export function ageForCheckout(birthday: string, now = new Date()): number | undefined {
  const age = ageFromBirthday(birthday, now);
  return age === null ? undefined : Math.min(99, Math.max(18, age));
}

export const GUEST_KEY = "ns_ob_guest";
export type GuestSaved = { d: Draft; step: number };

/** Reads what a guest typed before the email code. Anything that is not the expected shape is ignored. */
export function parseGuestSaved(raw: string | null): GuestSaved | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { d?: Partial<Draft>; step?: unknown } | null;
    const d = v?.d;
    if (!d || typeof d !== "object") return null;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string") : []);
    return {
      d: { ...(d as Draft), firstName: str(d.firstName), birthday: str(d.birthday), gender: str(d.gender), interestedIn: list(d.interestedIn) },
      step: typeof v?.step === "number" && Number.isFinite(v.step) ? v.step : 0
    };
  } catch { return null; }
}

export type Basics = Pick<Draft, "firstName" | "birthday" | "gender" | "interestedIn">;
export const basicsOf = (d: Draft): Basics => ({ firstName: d.firstName, birthday: d.birthday, gender: d.gender, interestedIn: d.interestedIn });
export const basicsBlank = (b: Basics) => b.firstName.trim() === "" && b.birthday === "" && !b.gender && b.interestedIn.length === 0;

/** Fills blank basics from answers the guest gave before signing in; answers already on the account always win. */
export function mergeGuestBasics(current: Draft, saved: GuestSaved | null): Draft {
  if (!saved || !basicsBlank(basicsOf(current))) return current;
  return { ...current, ...basicsOf(saved.d) };
}
