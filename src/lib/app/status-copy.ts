// What a client reads about each of their apps: the real status, what happens next, and who acts. Pure, so
// scripts/check-fulfilment.ts can test every state. No fake activity and no promised match or date counts.
import { APP_LABELS, effectiveStatus, isActiveStatus, type AppAccountRow } from "./domain";

export const START_WITHIN_HOURS = 72;
export type Actor = "you" | "us" | "nobody";
export type AppCopy = {
  /** The pill: Setting up, Needs you, Active, Paused, Closed. */
  label: string;
  tone: "lime" | "coral" | "grey";
  /** One or two plain sentences: where it stands and what happens next. */
  text: string;
  /** Who has to act next. */
  actor: Actor;
};

export type CopyContext = {
  /** A paid reservation exists. Until then the team has not been asked to start. */
  paid: boolean;
  /** Paid service is not offered in the client's country (free tools still work). Only false when the server knows; undefined reads as offered. */
  paidOffered?: boolean;
  /** A takedown report put the account on hold. It overrides whatever the team set. */
  hold?: "paused" | "closed" | null;
  /** Hours since the wait started (the later of finishing onboarding and paying). Only used to be honest about a late start. */
  hoursWaiting?: number | null;
};

export function appCopy(account: Pick<AppAccountRow, "app" | "status" | "user_paused" | "client_action_reason"> & { handoff_method?: AppAccountRow["handoff_method"] }, ctx: CopyContext): AppCopy {
  const name = APP_LABELS[account.app];
  if (ctx.hold === "closed") return { label: "Closed", tone: "grey", actor: "nobody", text: `Closed after a report. Nothing runs on your ${name}. The notice above says how to appeal.` };
  if (ctx.hold === "paused") return { label: "Paused", tone: "grey", actor: "nobody", text: `Paused after a report. Nothing runs on your ${name} until it is resolved. The notice above says how to appeal.` };
  if (account.user_paused) return { label: "Paused", tone: "grey", actor: "you", text: `You paused ${name}. Nothing is sent for you. Resume it when you are ready.` };
  const status = effectiveStatus(account);
  if (status === "needs_client_action") {
    const reason = account.client_action_reason?.trim();
    return { label: "Needs you", tone: "coral", actor: "you", text: `We need something from you: ${reason || "open Profile to see what is missing"}${reason && /[.!?]$/.test(reason) ? "" : "."} We continue as soon as you have done it.` };
  }
  if (isActiveStatus(status)) return { label: "Running", tone: "lime", actor: "us", text: `NoSwipe is running your ${name}. What happened today is below; matches and chats show up here as they happen.` };
  if (status === "paused") return { label: "Paused", tone: "grey", actor: "nobody", text: `Paused by our team. Nothing is sent for you on ${name}. Email support@noswipe.app if you did not expect this.` };
  if (status === "closed") return { label: "Closed", tone: "grey", actor: "nobody", text: `Closed. Nothing runs on your ${name}. Email support@noswipe.app if you want it opened again.` };
  // awaiting_login and setting_up: nothing runs yet
  if (!ctx.paid && ctx.paidOffered === false) return { label: "Not available yet", tone: "grey", actor: "nobody", text: `Running your ${name} for you is a paid service and it isn't offered in your country yet, so nothing runs on it. Your starter pack and reply helper still work.` };
  if (status === "awaiting_login" && ctx.paid) {
    const how = account.handoff_method === "invite"
      ? `We'll email you an invite for your ${name}. You accept it on your own phone and we take it from there.`
      : `We'll schedule a few minutes with you to log in to ${name} once, on a phone we set aside for you. We never ask for your password.`;
    const late = (ctx.hoursWaiting ?? 0) > START_WITHIN_HOURS ? ` This is taking longer than the ${START_WITHIN_HOURS} hours we said. Email support@noswipe.app if you want an update.` : ` A person on our team starts within ${START_WITHIN_HOURS} hours.`;
    return { label: "Waiting for login", tone: "coral", actor: (ctx.hoursWaiting ?? 0) > START_WITHIN_HOURS ? "us" : "you", text: `${how}${late}` };
  }
  if (!ctx.paid) return { label: "Not started", tone: "coral", actor: "you", text: `Waiting for you to activate NoSwipe. Nothing runs on your ${name} until then, and after you activate a person on our team starts within ${START_WITHIN_HOURS} hours.` };
  if ((ctx.hoursWaiting ?? 0) > START_WITHIN_HOURS) return { label: "Setting up", tone: "coral", actor: "us", text: `We're setting up your ${name}. This is taking longer than the ${START_WITHIN_HOURS} hours we said. Email support@noswipe.app if you want an update.` };
  return { label: "Setting up", tone: "coral", actor: "us", text: `We're setting up your ${name}. A person on our team will start within ${START_WITHIN_HOURS} hours.` };
}
