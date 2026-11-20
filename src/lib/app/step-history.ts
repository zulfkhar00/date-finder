// Browser back/forward inside onboarding. Each screen is one history entry carrying { nsStep }, so the phone's
// back gesture (or Android back key) goes to the previous question instead of dropping the visitor out of the flow.
// Pure decision logic, no window access, so scripts/check-step-history.ts can run it.

export type PopDecision =
  | { action: "go"; step: number }
  | { action: "stay" }
  | { action: "ignore" };

export const stepState = (step: number) => ({ nsStep: step });

/** Reads the step out of a history entry's state, or null when the entry is not one of ours. */
export function stepFromState(state: unknown): number | null {
  if (!state || typeof state !== "object") return null;
  const n = (state as { nsStep?: unknown }).nsStep;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * What to do when the browser moves to history entry `state`.
 * - not ours: leave it to the router (the visitor is leaving onboarding)
 * - mid-save, or past the last form step (the pay step has no way back), or an entry past the last form step: stay
 * - otherwise show that step
 */
export function decidePop(current: number, state: unknown, lastForm: number, locked: boolean): PopDecision {
  const target = stepFromState(state);
  if (target === null) return { action: "ignore" };
  if (target === current) return { action: "ignore" };
  if (locked || current > lastForm || target > lastForm) return { action: "stay" };
  return { action: "go", step: target };
}

/**
 * Where Back goes on the first onboarding screen. There is no earlier question, so it leaves the flow:
 * to the page the visitor came from when that was a page of ours worth returning to, otherwise to the landing page.
 * (A same-origin referrer of /login, /auth or /onboarding itself would just bounce them back in.)
 */
export function leaveOnboardingTarget(input: { historyLength: number; referrer: string; origin: string }): "back" | "/" {
  const { historyLength, referrer, origin } = input;
  if (historyLength <= 1 || !referrer) return "/";
  try {
    const from = new URL(referrer);
    if (from.origin !== origin) return "/";
    if (/^\/(login|auth|onboarding)(\/|$)/.test(from.pathname)) return "/";
    return "back";
  } catch {
    return "/";
  }
}
