import type { RealFunnel } from "@/lib/real-funnel";
import type { SignupStats } from "@/lib/signups";

// The text of the daily ops digest. Pure: every input may be null (that query failed) and shows as
// "n/a" without touching the other lines, so one broken table never blanks or zeroes the whole digest.

const show = (value: number | undefined) => (value === undefined ? "n/a" : String(value));

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(new Date(iso));
}

export function signupsLine(signups: SignupStats | null, now: Date): string {
  const label = "Confirmed signups (first email confirmation)";
  if (!signups) return `${label}: n/a`;
  if (!signups.captureSince) return `${label}: n/a (not tracked yet)`;
  // Windows that start before tracking did are partial: say so instead of presenting a low count as the truth.
  const month = now.getTime() - 30 * 24 * 60 * 60 * 1000;
  const capture = Date.parse(signups.captureSince);
  const note = capture > month ? ` (counted since ${shortDate(signups.captureSince)})` : "";
  return `${label}: ${signups.day} (30d ${signups.month})${note}`;
}

export function buildDigestText(input: { now: Date; day: RealFunnel | null; month: RealFunnel | null; signups: SignupStats | null; refs: string | null }): string {
  const { now, day, month, signups, refs } = input;
  const line = (label: string, pick: (f: RealFunnel) => number) => `${label}: ${show(day ? pick(day) : undefined)} (30d ${show(month ? pick(month) : undefined)})`;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" }).format(now);
  const ex = month?.excluded;
  return [
    `📊 Daily digest, ${date} (last 24h, real traffic only)`,
    line("Page views (visitors)", (f) => f.visitors),
    line("Get started clicks", (f) => f.getStarted),
    signupsLine(signups, now),
    line("Onboarding opened", (f) => f.reserveStarts),
    line("Onboarding done", (f) => f.onboardingComplete),
    line("Checkout opened", (f) => f.checkouts),
    line("Paid $1", (f) => f.paid),
    `Paid by ref: ${refs ?? "n/a"}`,
    ex ? `Excluded (30d): ${ex.founder} founder, ${ex.test_email} test email, ${ex.stripe_test} Stripe test checkouts, ${ex.internalSessions} internal sessions` : "Excluded: n/a"
  ].join("\n");
}
