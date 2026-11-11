// "Finish setting up" card for a signed-in user who finished onboarding but has not paid.
// Pure logic (no I/O at import time) so scripts/check-app.ts can test it without a browser.

export const RESUME_COPY = {
  title: "One step left: activate NoSwipe so it starts swiping and chatting for you",
  body: "Your profile is ready. Activate to switch it on. It swipes, chats in your voice and books the date. You just show up.",
  button: "Activate NoSwipe",
  opening: "Opening checkout…",
  confirming: "Confirming your payment…",
  doneTitle: "You're activated",
  doneBody: "Payment received. NoSwipe is setting up your apps now, and your matches and chats show up here.",
  retry: "Checkout could not open. You have not been charged. Please try again."
} as const;

/** Words the card must never use (standing positioning rule). The price appears on the Stripe page only. */
export const RESUME_FORBIDDEN = /\$\s?\d|\b(reserve[ds]?|reservation|spot|waitlist|wait list|queue|first batch|early access|refund\w*)\b/i;

export type ResumeData = {
  email: string;
  city: string;
  interestedIn: string[];
  lookingFor: string | null;
  name: string;
  age: number | null;
  apps: string[];
  ageMin: number | null;
  ageMax: number | null;
  interests: string[];
};

const GOALS = ["committed", "meaningful", "exploring"] as const;
const APPS = ["tinder", "bumble", "hinge"] as const;

/** The /api/checkout body for a user who is already onboarded. Every answer is optional, none can block it. */
export function buildResumePayload(d: ResumeData, extra: { attribution: unknown; funnelSessionId: string }) {
  const pref = d.interestedIn.length === 1 && (d.interestedIn[0] === "women" || d.interestedIn[0] === "men") ? d.interestedIn[0] : "all_genders";
  const goal = (GOALS as readonly string[]).includes(d.lookingFor ?? "") ? d.lookingFor : "meaningful";
  const min = Math.min(99, Math.max(18, d.ageMin ?? 18));
  const max = Math.min(99, Math.max(min, d.ageMax ?? 99));
  return {
    checkoutMode: "embedded", ageConfirmed: true, termsAccepted: true, email: d.email, city: d.city.trim(),
    datingPreference: pref, relationshipGoal: goal, dateFrequency: "twice_monthly",
    onboarding: {
      name: d.name.trim().slice(0, 60),
      age: d.age ? Math.min(99, Math.max(18, d.age)) : undefined,
      apps: d.apps.filter((a) => (APPS as readonly string[]).includes(a)),
      ageMin: min, ageMax: max,
      interests: d.interests.filter(Boolean).join(", ").slice(0, 300)
    },
    attribution: extra.attribution, funnelSessionId: extra.funnelSessionId
  };
}

export const CONFIRM_POLL_MS = 1500;
export const CONFIRM_MAX_MS = 10_000;

/**
 * After Stripe says the payment completed, the webhook may not have landed yet. Poll the reservation
 * status for at most CONFIRM_MAX_MS. "paid" = webhook seen; "unconfirmed" = still pending at the limit
 * (the caller shows the success state anyway: Stripe already confirmed the payment, and there is never a second pay button).
 */
export async function pollUntilPaid(
  fetchStatus: () => Promise<string | null>,
  opts: { intervalMs?: number; maxMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {}
): Promise<"paid" | "unconfirmed"> {
  const interval = opts.intervalMs ?? CONFIRM_POLL_MS;
  const max = opts.maxMs ?? CONFIRM_MAX_MS;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  const start = now();
  for (;;) {
    let status: string | null = null;
    try { status = await fetchStatus(); } catch { /* retry until the limit */ }
    if (status === "paid") return "paid";
    if (now() - start + interval > max) return "unconfirmed";
    await sleep(interval);
  }
}
