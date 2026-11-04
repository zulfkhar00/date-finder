// Content of the "you're in" email sent once a $1 reservation is paid. Pure and dependency-free so
// `npm test` can import it directly (scripts/check-email.mjs). Sending lives in src/lib/email.ts.

export const CONFIRMATION_EMAIL_LINK = "https://noswipe.app";
// Absolute and PNG: Gmail blocks SVG and relative images. Served from public/brand on the site.
export const EMAIL_LOGO_URL = "https://www.noswipe.app/brand/email-logo.png";

export type ConfirmationEmail = { subject: string; text: string; html: string };

export function buildConfirmationEmail(): ConfirmationEmail {
  const subject = "You're in — your spot is reserved";
  const footer = "You're getting this because you signed up at NoSwipe. Your $1 is refundable. Questions? Just reply to this email.";

  const text = [
    "You're in — your spot is reserved.",
    "",
    "You're on the early-access list. Sign in at noswipe.app to see your profile and your apps.",
    "NoSwipe sets up and runs your dating profiles, and chats as you. You can pause any app or take over any chat from the app at any time.",
    "Nothing to do until then.",
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
<p style="margin:0 0 24px;"><img src="${EMAIL_LOGO_URL}" width="48" height="48" alt="NoSwipe" style="display:block;border:0;width:48px;height:48px;"></p>
<p style="margin:0 0 16px;font-size:22px;font-weight:700;">You're in — your spot is reserved.</p>
<p style="margin:0 0 16px;">You're on the early-access list. Sign in at noswipe.app to see your profile and your apps.</p>
<p style="margin:0 0 16px;">NoSwipe sets up and runs your dating profiles, and chats as you. You can pause any app or take over any chat from the app at any time.</p>
<p style="margin:0 0 16px;">Nothing to do until then.</p>
<p style="margin:0 0 32px;"><a href="${CONFIRMATION_EMAIL_LINK}" style="color:#111111;">noswipe.app</a></p>
<p style="margin:0;font-size:13px;color:#666666;">${footer}</p>
</div>
</body>
</html>`;

  return { subject, text, html };
}
