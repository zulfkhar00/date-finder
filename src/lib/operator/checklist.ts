// Account creation checklist: pure rules. No I/O and no server-only imports, so `npm test` (scripts/check-operator.mts) runs it directly.
// create account -> verify -> upload photos -> set filters -> assign phone -> first session. When the last box is ticked and the
// app is still "setting up", the app becomes active on its own. The rig only runs it when a phone is assigned (shouldRun), so a
// ticked checklist can never start an app without one.
import { REASON_MAX, REASON_MIN, effectiveStatus, type AppStatus } from "@/lib/app/domain";

export const CHECKLIST_STEPS = ["create_account", "verify", "upload_photos", "set_filters", "assign_phone", "first_session"] as const;
export type ChecklistStep = (typeof CHECKLIST_STEPS)[number];
export const STEP_LABELS: Record<ChecklistStep, string> = {
  create_account: "Create the account", verify: "Verify it (selfie / phone / email)", upload_photos: "Upload the photos in kit order",
  set_filters: "Set the filters", assign_phone: "Assign a phone", first_session: "Run the first session"
};

export function isStep(value: unknown): value is ChecklistStep {
  return typeof value === "string" && (CHECKLIST_STEPS as readonly string[]).includes(value);
}

export type StepTick = { step: ChecklistStep; doneBy: string; doneAt: string };

export function progress(ticks: readonly Pick<StepTick, "step">[]): { done: number; total: number; complete: boolean; next: ChecklistStep | null } {
  const have = new Set(ticks.map((t) => t.step));
  const done = CHECKLIST_STEPS.filter((s) => have.has(s)).length;
  return { done, total: CHECKLIST_STEPS.length, complete: done === CHECKLIST_STEPS.length, next: CHECKLIST_STEPS.find((s) => !have.has(s)) ?? null };
}

/** Can the step be ticked right now? "Assign a phone" is only true when a phone is really assigned. */
export function canTick(step: ChecklistStep, ctx: { phoneAssigned: boolean }): { ok: true } | { ok: false; message: string } {
  if (step === "assign_phone" && !ctx.phoneAssigned) return { ok: false, message: "Assign the phone in the Run panel first." };
  return { ok: true };
}

export type Transition = { to: "active" | null; why: "complete" | "not_complete" | "not_setting_up" | "client_paused" };

/**
 * What a ticked checklist does to the status. Only an app that is "setting up" (or the retired awaiting_login) moves, and only
 * when every step is done. A client who paused mid-setup keeps their pause (nothing activates until they resume); an app that
 * needs the client, was paused or closed by the team, or is already running is left alone.
 */
export function decideTransition(account: { status: AppStatus; user_paused: boolean }, ticks: readonly Pick<StepTick, "step">[]): Transition {
  if (account.user_paused) return { to: null, why: "client_paused" };
  if (effectiveStatus(account) !== "setting_up") return { to: null, why: "not_setting_up" };
  return progress(ticks).complete ? { to: "active", why: "complete" } : { to: null, why: "not_complete" };
}

// --- "needs you" reason templates -------------------------------------------------------------------------------

export const NEEDS_YOU_TEMPLATES = [
  { id: "selfie", label: "Selfie for verification", text: "Send us a clear selfie, face visible, no sunglasses. We need it to verify your profile." },
  { id: "photos", label: "More or better photos", text: "Add 2 more clear photos of you in Profile. We need at least 4 where your face is visible." },
  { id: "code", label: "Verification code", text: "The app sent you a verification code. Reply with it in the next 10 minutes." },
  { id: "phone", label: "Phone number", text: "Add the phone number you want the dating app tied to in Profile." },
  { id: "details", label: "Missing profile details", text: "Finish your Profile (job, city and what you are looking for) so we can write your bio." }
] as const;
export type NeedsYouTemplateId = (typeof NEEDS_YOU_TEMPLATES)[number]["id"];

/** The reason the client reads: a template, or the operator's own words. Normalised and length-checked like every other reason. */
export function resolveReason(templateId: string, custom: string): { ok: true; reason: string } | { ok: false; error: string } {
  const own = custom.replace(/\s+/g, " ").trim();
  const template = NEEDS_YOU_TEMPLATES.find((t) => t.id === templateId);
  const reason = own || template?.text || "";
  if (reason.length < REASON_MIN) return { ok: false, error: "Pick a template or write what the client needs to do." };
  if (reason.length > REASON_MAX) return { ok: false, error: `Keep the reason under ${REASON_MAX} characters.` };
  return { ok: true, reason };
}
