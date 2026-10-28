import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildAdminLoginEmail } from "@/lib/admin-login-email";
import { buildConfirmationEmail } from "@/lib/confirmation-email";

const RESEND_URL = "https://api.resend.com/emails";
// Postgres "undefined column" and PostgREST "column not in schema cache": the migration
// supabase/2026-10-23-confirmation-email.sql hasn't been applied yet.
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

type Recipient = { email: string; queue_position: number | null };

function emailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined };
}

type Message = { to: string; subject: string; text: string; html: string; idempotencyKey?: string };

/** Sends through Resend. Returns true on a 2xx. Logs status codes only, never addresses or content. */
async function sendViaResend(config: NonNullable<ReturnType<typeof emailConfig>>, message: Message, label: string) {
  const { to, subject, text, html, idempotencyKey } = message;
  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        // Resend drops a repeat with the same key for 24 hours: a second guard against double sends.
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body: JSON.stringify({ from: config.from, to: [to], subject, text, html, ...(config.replyTo ? { reply_to: config.replyTo } : {}) }),
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) console.error(`${label} failed`, response.status);
    return response.ok;
  } catch (error) {
    console.error(`${label} failed`, error instanceof Error ? error.name : "unknown error");
    return false;
  }
}

function confirmationMessage(to: string, idempotencyKey: string): Message {
  return { to, idempotencyKey, ...buildConfirmationEmail() };
}

/** True when Resend is configured (RESEND_API_KEY + EMAIL_FROM). */
export function canSendEmail(): boolean {
  return emailConfig() !== null;
}

/**
 * The founder sign-in email for /admin/login, sent from NoSwipe through Resend. `link` must be
 * built from SITE_URL. Returns true on success. Never logs the address, link or code.
 */
export async function sendAdminLoginEmail(to: string, link: string, code: string): Promise<boolean> {
  const config = emailConfig();
  if (!config) return false;
  return sendViaResend(config, { to, ...buildAdminLoginEmail(link, code) }, "Admin sign-in email");
}

/**
 * Sends the "you're #N in line" email once per paid reservation. Never throws: an email problem
 * must not fail the Stripe webhook (a 500 makes Stripe retry the whole event).
 *
 * Once guard: claims `confirmation_email_sent_at` with a conditional update before sending, and
 * releases it if Resend fails. If that column doesn't exist yet, falls back to `firstDelivery`
 * (the webhook's existing dedupe on the `paid` funnel event) plus Resend's idempotency key.
 */
export async function sendReservationConfirmation(supabase: SupabaseClient, reservationId: string, firstDelivery: boolean | null): Promise<void> {
  try {
    const config = emailConfig();
    if (!config) return;
    const idempotencyKey = `reservation-confirmation/${reservationId}`;

    const claim = await supabase
      .from("reservations")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", reservationId)
      .eq("status", "paid")
      .is("confirmation_email_sent_at", null)
      .select("email, queue_position")
      .maybeSingle<Recipient>();

    if (!claim.error) {
      if (!claim.data?.queue_position) return; // Already sent, or not paid.
      const sent = await sendViaResend(config, confirmationMessage(claim.data.email, idempotencyKey), "Confirmation email");
      if (!sent) {
        const { error } = await supabase.from("reservations").update({ confirmation_email_sent_at: null }).eq("id", reservationId);
        if (error) console.error("Confirmation email release failed", error.code);
      }
      return;
    }

    if (!MISSING_COLUMN_CODES.has(claim.error.code)) {
      console.error("Confirmation email claim failed", claim.error.code);
      return;
    }
    if (firstDelivery === false) return; // This Stripe event was already processed.
    const { data, error } = await supabase.from("reservations").select("email, queue_position").eq("id", reservationId).eq("status", "paid").maybeSingle<Recipient>();
    if (error) {
      console.error("Confirmation email lookup failed", error.code);
      return;
    }
    if (data?.queue_position) await sendViaResend(config, confirmationMessage(data.email, idempotencyKey), "Confirmation email");
  } catch (error) {
    console.error("Confirmation email failed", error instanceof Error ? error.name : "unknown error");
  }
}
