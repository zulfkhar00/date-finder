"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminEmailForUser, adminEmailOrNull, createAuthClient } from "@/lib/admin-auth";
import { isAdminEmail, readAdminConfig } from "@/lib/admin-config";
import { LEAD_STAGES, UUID_PATTERN, saveLeadNotes } from "./data";

export type LoginState = { step: "email" | "code"; email?: string; message?: string; error?: string };

const emailSchema = z.email().max(254).transform((value) => value.trim().toLowerCase());
const codeSchema = z.string().trim().regex(/^\d{6,10}$/);

// Supabase answers these when the address has no user and shouldCreateUser is false.
const NO_USER_CODES = new Set(["otp_disabled", "signup_disabled", "user_not_found"]);

const SENT_MESSAGE = "If this address is on the admin list, a sign-in link and code are on their way. The link works in this browser; the code works anywhere.";

/** Step 1: email a magic link + one-time code, but only to allowlisted addresses. */
export async function requestLoginLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const { config } = readAdminConfig();
  if (!config) return { step: "email", error: "Admin sign-in is not configured on this server." };

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "Enter a valid email address." };
  const email = parsed.data;

  // Same response either way, so the form does not reveal who is an admin.
  if (!isAdminEmail(config, email)) return { step: "code", email, message: SENT_MESSAGE };

  try {
    const supabase = await createAuthClient(config);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Admin users are created by hand in Supabase (DEPLOYMENT.md §7); this never signs anyone up.
      // The link is built from SITE_URL only, never from request headers.
      options: { shouldCreateUser: false, emailRedirectTo: `${config.siteUrl}/admin/auth/callback` }
    });
    if (error && error.code && NO_USER_CODES.has(error.code)) {
      // Allowlisted, but no Supabase user was created for it: nothing is sent, same neutral message.
      console.error("Admin sign-in skipped", error.code);
      return { step: "code", email, message: SENT_MESSAGE };
    }
    if (error) {
      console.error("Admin sign-in email failed", error.code ?? error.status ?? "unknown");
      return { step: "email", email, error: "Couldn't send the email right now. Wait a minute and try again." };
    }
  } catch (error) {
    console.error("Admin sign-in email failed", error instanceof Error ? error.name : "unknown error");
    return { step: "email", email, error: "Couldn't send the email right now. Wait a minute and try again." };
  }
  return { step: "code", email, message: SENT_MESSAGE };
}

/** Step 2 (alternative to clicking the link): verify the emailed one-time code. */
export async function verifyLoginCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const { config } = readAdminConfig();
  if (!config) return { step: "email", error: "Admin sign-in is not configured on this server." };

  const email = emailSchema.safeParse(formData.get("email"));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!email.success) return { step: "email", error: "Enter a valid email address." };
  if (!code.success) return { step: "code", email: email.data, message: prev.message, error: "Enter the code from the email (digits only)." };

  const invalid: LoginState = { step: "code", email: email.data, message: prev.message, error: "That code is invalid or has expired." };
  if (!isAdminEmail(config, email.data)) return invalid;

  try {
    const supabase = await createAuthClient(config);
    const { data, error } = await supabase.auth.verifyOtp({ email: email.data, token: code.data, type: "email" });
    if (error || !data.user) {
      if (error) console.error("Admin code verification failed", error.code ?? error.status ?? "unknown");
      return invalid;
    }
    if (!adminEmailForUser(config, data.user)) {
      // Unconfirmed email, or not the allowlisted address: drop the session we just got.
      await supabase.auth.signOut();
      return invalid;
    }
  } catch (error) {
    console.error("Admin code verification failed", error instanceof Error ? error.name : "unknown error");
    return invalid;
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  const { config } = readAdminConfig();
  if (config) {
    try {
      const supabase = await createAuthClient(config);
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Admin sign-out failed", error instanceof Error ? error.name : "unknown error");
    }
  }
  redirect("/admin/login");
}

export type NotesState = { ok?: boolean; error?: string; savedAt?: string };

const notesSchema = z.object({
  stage: z.enum(LEAD_STAGES),
  notes: z.string().max(5000).transform((value) => value.replace(/\r\n/g, "\n"))
});

export async function updateLeadNotes(id: string, _prev: NotesState, formData: FormData): Promise<NotesState> {
  const adminEmail = await adminEmailOrNull();
  if (!adminEmail) return { error: "Not authorized." };
  if (!UUID_PATTERN.test(id)) return { error: "Unknown lead." };

  const parsed = notesSchema.safeParse({ stage: formData.get("stage"), notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { error: "Pick a stage and keep notes under 5,000 characters." };

  const result = await saveLeadNotes(id, parsed.data.stage, parsed.data.notes, adminEmail);
  if (result === "missing") return { error: "This lead no longer exists." };
  if (result === "unavailable") return { error: "Couldn't save. Has supabase/2026-10-23-admin.sql been applied?" };

  revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/admin/leads");
  return { ok: true, savedAt: new Date().toISOString() };
}
