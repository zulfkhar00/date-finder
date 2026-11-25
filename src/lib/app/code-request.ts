import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { canSendEmail, sendAppEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { trustedClientIp } from "./code-send-limit";
import { readAppConfig } from "./config";
import { createCodeRequester, deliverSignInCode } from "./sign-in-code";

/** One instance, so /login and onboarding share the throttles. */
export const requestSignInCode = createCodeRequester({
  ready: () => readAppConfig() !== null && canSendEmail(),
  clientIp: async () => trustedClientIp(await headers()),
  deliver: async (email, mode) => {
    const config = readAppConfig();
    if (!config) return "failed";
    try {
      return await deliverSignInCode(
        { admin: getSupabaseAdmin(), siteUrl: config.siteUrl, send: (to, message) => sendAppEmail(to, message, "Sign-in email") },
        email,
        mode
      );
    } catch (error) {
      console.error("Sign-in email failed", error instanceof Error ? error.name : "unknown error");
      return "failed";
    }
  },
  defer: (task) => after(task)
});
