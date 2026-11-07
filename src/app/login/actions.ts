"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { buildLoginEmail } from "@/lib/app-emails";
import { readAppConfig } from "@/lib/app/config";
import { createAppClient } from "@/lib/app/session";
import { canSendEmail, sendAppEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type LoginState = { step: "email" | "code" | "done"; email?: string; error?: string; notice?: string };

const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
const codeSchema = z.string().trim().regex(/^\d{6,10}$/);
const SEND_FAILED = "Couldn't send the email right now. Wait a minute and try again.";

// Best-effort per-instance throttle so one address can't be mailed in a loop.
const lastSent = new Map<string, number>();

/**
 * Step 1: email a sign-in link and code. New addresses get an account on the spot (that is how
 * "we create accounts for them" works), created server-side with the service key so public
 * signup can stay off in Supabase. The email goes out from NoSwipe through Resend.
 */
export async function requestCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const config = readAppConfig();
  if (!config) return { step: "email", error: "Sign-in is not available right now." };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;
  if (!canSendEmail()) return { step: "email", email, error: SEND_FAILED };

  const now = Date.now();
  if (now - (lastSent.get(email) ?? 0) < 45_000) return { step: "code", email, notice: "A code was just sent. Give it a minute, then try again." };
  lastSent.set(email, now);
  if (lastSent.size > 5000) lastSent.clear();

  try {
    const sb = getSupabaseAdmin();
    const created = await sb.auth.admin.createUser({ email, email_confirm: true });
    if (created.error && created.error.code !== "email_exists") {
      console.error("Sign-in user create failed", created.error.code ?? created.error.status ?? "unknown");
      return { step: "email", email, error: SEND_FAILED };
    }
    const { data, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data.properties?.hashed_token || !data.properties.email_otp) {
      console.error("Sign-in link failed", error?.code ?? error?.status ?? "missing_properties");
      return { step: "email", email, error: SEND_FAILED };
    }
    const link = new URL("/auth/callback", config.siteUrl);
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", "email");
    const sent = await sendAppEmail(email, buildLoginEmail(link.toString(), data.properties.email_otp), "Sign-in email");
    if (!sent) return { step: "email", email, error: SEND_FAILED };
  } catch (error) {
    console.error("Sign-in email failed", error instanceof Error ? error.name : "unknown error");
    return { step: "email", email, error: SEND_FAILED };
  }
  return { step: "code", email, notice: "New code sent. Older codes no longer work." };
}

async function checkCode(formData: FormData): Promise<LoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!email.success) return { step: "email", error: "Enter a valid email address." };
  if (!code.success) return { step: "code", email: email.data, error: "Enter the code from the email (digits only)." };
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
    if (error || !data.user) {
      if (error) console.error("Code verification failed", error.code ?? error.status ?? "unknown");
      return { step: "code", email: email.data, error: "That code is invalid or has expired." };
    }
  } catch (error) {
    console.error("Code verification failed", error instanceof Error ? error.name : "unknown error");
    return { step: "code", email: email.data, error: "That code is invalid or has expired." };
  }
  return { step: "done", email: email.data };
}

/** Step 2 (instead of clicking the link): verify the emailed code. */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const result = await checkCode(formData);
  if (result.step === "done") redirect("/home");
  return result;
}

/** Same check, but stays on the page: the onboarding flow signs the visitor in mid-way and keeps going. */
export async function verifyCodeInline(_prev: LoginState, formData: FormData): Promise<LoginState> {
  return checkCode(formData);
}
