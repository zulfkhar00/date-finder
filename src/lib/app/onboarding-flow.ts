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

/** The address a sign-in code was just sent to, kept for this tab so a reload comes back to the code field. */
export const PENDING_CODE_KEY = "ns_ob_code";
/** The emailed code does not outlive this, so an older entry is ignored. */
export const PENDING_CODE_TTL_MS = 60 * 60_000;
export const pendingCodeValue = (email: string, now = Date.now()) => JSON.stringify({ email, at: now });
/** The address of a code that can still be typed in, or null (nothing stored, too old, or not the expected shape). */
export function parsePendingCode(raw: string | null, now = Date.now()): string | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { email?: unknown; at?: unknown } | null;
    if (typeof v?.email !== "string" || !v.email.includes("@") || typeof v.at !== "number") return null;
    return now - v.at >= 0 && now - v.at < PENDING_CODE_TTL_MS ? v.email : null;
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

/** Heading and line for the email-code screen. Once the code is on its way the screen has to say so: a heading that still asks for the email reads as if nothing happened. */
export function accountCopy(codeSent: boolean): { title: string; sub: string } {
  return codeSent
    ? { title: "Check your email", sub: "Enter the code we just sent. It can take a minute to arrive; look in spam if you don't see it." }
    : { title: "Where should we send your code?", sub: "Nice. Your answers are ready. Enter your email to save your profile. No password, just a code." };
}

/** Label for the main button. The basics screen never says "Skip": the birthday is required there, so Skip would only show an error. */
export function primaryLabel(key: string, blank: boolean): string {
  if (key === "consent") return "Create my profiles";
  return blank && key !== "basics" ? "Skip for now" : "Continue";
}
