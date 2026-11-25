// Asking for a sign-in code: who gets one, and who gets an account. No Next or "server-only" imports, so the
// checks can drive it. The Next wiring is in ./code-request.ts.
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildLoginEmail, type AppEmail } from "../app-emails";
import { createSendLimiter, networkKey, sendLimitMessage } from "./code-send-limit";

/** "existing" is /login: it mails only people we already know. "signup" is onboarding: it creates the account. */
export type CodeMode = "existing" | "signup";
export type LoginState = { step: "email" | "code" | "done"; email?: string; error?: string; notice?: string };
export type Delivery = "sent" | "no_account" | "failed";

export const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
const SEND_FAILED = "Couldn't send the email right now. Wait a minute and try again.";

type DeliveryDeps = { admin: SupabaseClient; siteUrl: string; send: (to: string, email: AppEmail) => Promise<boolean> };

/**
 * Makes a one-time sign-in link and code and emails them from NoSwipe. Accounts are created server-side with the
 * service key, so public signup can stay off in Supabase. Supabase itself sends nothing here.
 *
 * In "existing" mode an unknown address gets no account and no email. The one exception is an address with a paid
 * reservation and no account yet (paid before accounts existed, or paid under another address than the one they
 * signed in with): those people paid, so signing in creates the account. Never throws; logs codes only.
 */
export async function deliverSignInCode({ admin, siteUrl, send }: DeliveryDeps, email: string, mode: CodeMode): Promise<Delivery> {
  try {
    let create = mode === "signup";
    if (!create) {
      // The existence check. Supabase refuses a "recovery" link for an unknown address and creates nothing, whereas
      // a "magiclink" one would sign the address up. So "magiclink" must never be asked for before this passes.
      const lookup = await admin.auth.admin.generateLink({ type: "recovery", email });
      if (lookup.error) {
        if (lookup.error.code !== "user_not_found" && lookup.error.status !== 404) {
          console.error("Sign-in account lookup failed", lookup.error.code ?? lookup.error.status ?? "unknown");
          return "failed";
        }
        const paid = await admin.from("reservations").select("id").eq("email", email).eq("status", "paid").limit(1);
        if (paid.error) {
          console.error("Sign-in reservation lookup failed", paid.error.code ?? "unknown");
          return "failed";
        }
        if (!paid.data?.length) return "no_account";
        create = true;
      }
    }
    if (create) {
      const created = await admin.auth.admin.createUser({ email, email_confirm: true });
      if (created.error && created.error.code !== "email_exists") {
        console.error("Sign-in user create failed", created.error.code ?? created.error.status ?? "unknown");
        return "failed";
      }
    }
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties?.hashed_token || !data.properties.email_otp) {
      console.error("Sign-in link failed", error?.code ?? error?.status ?? "missing_properties");
      return "failed";
    }
    const link = new URL("/auth/callback", siteUrl);
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", "email");
    return (await send(email, buildLoginEmail(link.toString(), data.properties.email_otp))) ? "sent" : "failed";
  } catch (error) {
    console.error("Sign-in email failed", error instanceof Error ? error.name : "unknown error");
    return "failed";
  }
}

type RequestEnv = {
  /** Sign-in and email are configured. */
  ready: () => boolean;
  clientIp: () => Promise<string | null>;
  deliver: (email: string, mode: CodeMode) => Promise<Delivery>;
  /** Runs the task after the response has been sent. */
  defer: (task: () => Promise<unknown>) => void;
  now?: () => number;
};

/** Step 1 of both sign-in forms: validate, throttle, then hand the address to delivery. */
export function createCodeRequester(env: RequestEnv) {
  // Best-effort per-instance throttles: one email address can't be mailed in a loop, and one network can't mail many.
  const lastSent = new Map<string, number>();
  const networkSends = createSendLimiter();

  return async function requestSignInCode(mode: CodeMode, prev: LoginState, formData: FormData): Promise<LoginState> {
    const parsed = emailSchema.safeParse(formData.get("email"));
    if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
    const email = parsed.data;
    if (!env.ready()) return { step: "email", email, error: SEND_FAILED };

    const now = env.now?.() ?? Date.now();
    // Per mode: a /login try for an unknown address sends nothing, and must not delay that person's signup.
    const key = `${mode}:${email}`;
    if (now - (lastSent.get(key) ?? 0) < 45_000) return { step: "code", email, notice: "A code was just sent. Give it a minute, then try again." };
    // Counted before anything is looked up, created or mailed. An unknown address (no proxy header) is not limited.
    const ip = await env.clientIp();
    const wait = ip ? networkSends.take(networkKey(ip), now) : 0;
    if (wait) {
      // A refused resend stays on the code screen, so the code already in the inbox can still be typed in.
      const hasCode = prev.step === "code" && prev.email === email;
      return { step: hasCode ? "code" : "email", email, error: sendLimitMessage(wait, hasCode) };
    }
    lastSent.set(key, now);
    if (lastSent.size > 5000) lastSent.clear();

    if (mode === "existing") {
      // Answered before the account is looked up, so neither the words nor the response time say whether it exists.
      env.defer(() => env.deliver(email, mode));
    } else if ((await env.deliver(email, mode)) !== "sent") {
      return { step: "email", email, error: SEND_FAILED };
    }
    return { step: "code", email, notice: "New code sent." };
  };
}
