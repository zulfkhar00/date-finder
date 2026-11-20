"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { buildResetEmail } from "@/lib/app-emails";
import { readAppConfig } from "@/lib/app/config";
import { MIN_PASSWORD_LENGTH, isOwner, isOwnerEmail, ownerAllowlist } from "@/lib/app/owner";
import { createAppClient, getAppUser } from "@/lib/app/session";
import { canSendEmail, sendAppEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type OwnerLoginState = { error?: string; notice?: string };

const emailSchema = z.email().max(254).transform((v) => v.trim().toLowerCase());
const GENERIC = "That email and password don't match.";

// Best-effort per-instance throttle: a handful of tries per address, then wait. Supabase rate-limits on its side too.
const tries = new Map<string, { n: number; since: number }>();
function throttled(key: string): boolean {
  const now = Date.now();
  const t = tries.get(key);
  if (!t || now - t.since > 15 * 60_000) { tries.set(key, { n: 1, since: now }); return false; }
  t.n += 1;
  if (tries.size > 2000) tries.clear();
  return t.n > 8;
}

/** Email + password. Anyone who is not on the owner list gets the very same message as a wrong password. */
export async function signInOwner(_prev: OwnerLoginState, formData: FormData): Promise<OwnerLoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!email.success || !password || password.length > 200) return { error: GENERIC };
  if (!readAppConfig()) return { error: "Sign-in is not available right now." };
  if (throttled(email.data)) return { error: "Too many tries. Wait a few minutes and try again." };
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
    if (error || !data.user) return { error: GENERIC };
    if (!isOwner(data.user, ownerAllowlist())) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: GENERIC };
    }
  } catch (error) {
    console.error("Owner sign-in failed", error instanceof Error ? error.name : "unknown error");
    return { error: GENERIC };
  }
  redirect("/app");
}

const SENT = "If that address can sign in here, a reset link is on its way. It expires in 1 hour.";

/** Always answers the same, whether or not the address is on the list or the email went out. */
export async function requestReset(_prev: OwnerLoginState, formData: FormData): Promise<OwnerLoginState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const config = readAppConfig();
  if (!config || !canSendEmail() || !isOwnerEmail(email.data, ownerAllowlist()) || throttled(`reset:${email.data}`)) return { notice: SENT };
  try {
    const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({ type: "recovery", email: email.data });
    if (error || !data.properties?.hashed_token) {
      console.error("Reset link failed", error?.code ?? error?.status ?? "missing_properties");
      return { notice: SENT };
    }
    const link = new URL("/app/auth", config.siteUrl);
    link.searchParams.set("token_hash", data.properties.hashed_token);
    link.searchParams.set("type", "recovery");
    await sendAppEmail(email.data, buildResetEmail(link.toString()), "Reset email");
  } catch (error) {
    console.error("Reset email failed", error instanceof Error ? error.name : "unknown error");
  }
  return { notice: SENT };
}

/** After the emailed link: choose a new password for the signed-in owner. */
export async function setOwnerPassword(_prev: OwnerLoginState, formData: FormData): Promise<OwnerLoginState> {
  const user = await getAppUser();
  if (!isOwner(user, ownerAllowlist())) redirect("/app/login");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password.length > 200) return { error: "That password is too long." };
  if (password !== String(formData.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  try {
    const supabase = await createAppClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error("Password update failed", error.code ?? error.status ?? "unknown");
      return { error: "Couldn't save that password. Try a different one." };
    }
  } catch {
    return { error: "Couldn't save that password. Try again." };
  }
  redirect("/app");
}

/** Sign out of this browser and go back to the sign-in screen. */
export async function signOutOwner(): Promise<void> {
  try {
    const supabase = await createAppClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch { /* the redirect below leaves the app regardless */ }
  redirect("/app/login");
}
