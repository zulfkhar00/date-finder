// Content of the "you're in" email sent once a $1 reservation is paid. Pure and dependency-free so
// `npm test` can import it directly (scripts/check-email.mjs). Sending lives in src/lib/email.ts.

export const CONFIRMATION_EMAIL_LINK = "https://noswipe.app";

export type ConfirmationEmail = { subject: string; text: string; html: string };

export function buildConfirmationEmail(queuePosition: number): ConfirmationEmail {
  if (!Number.isSafeInteger(queuePosition) || queuePosition < 1) throw new Error("Invalid queue position");
  const n = `#${queuePosition}`;
  const subject = `Thanks! We're reviewing your NoSwipe application`;
  const footer = "You're getting this because you applied at NoSwipe. Questions? Just reply to this email.";

  const text = [
    "Thanks for applying to NoSwipe.",
    "",
    `We're reviewing your application now. You're ${n} in the queue, and we're onboarding in small batches. We'll email you as soon as your batch is ready. Nothing to do until then.`,
    "",
    CONFIRMATION_EMAIL_LINK,
    "",
    "--",
    footer
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111111;">
<p style="margin:0 0 16px;font-size:22px;font-weight:700;">Thanks for applying to NoSwipe.</p>
<p style="margin:0 0 16px;">We're reviewing your application now. You're <strong>${n}</strong> in the queue, and we're onboarding in small batches. We'll email you as soon as your batch is ready. Nothing to do until then.</p>
<p style="margin:0 0 32px;"><a href="${CONFIRMATION_EMAIL_LINK}" style="color:#111111;">noswipe.app</a></p>
<p style="margin:0;font-size:13px;color:#666666;">${footer}</p>
</div>
</body>
</html>`;

  return { subject, text, html };
}
