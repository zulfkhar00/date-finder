"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requestSignInCode } from "@/lib/app/code-request";
import { createAppClient } from "@/lib/app/session";
import { emailSchema, type LoginState } from "@/lib/app/sign-in-code";

const codeSchema = z.string().trim().regex(/^\d{6,10}$/);

/**
 * Step 1 on /login: email a sign-in link and code to someone we already know. It never creates an account for an
 * unknown address (new people sign up in /onboarding, see ../onboarding/actions.ts), and answers the same either way.
 */
export async function requestCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  return requestSignInCode("existing", prev, formData);
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
