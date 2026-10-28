// Content of the founder sign-in email for /admin/login. Same plain white style as the
// confirmation email (logo on top). Pure and dependency-free so `npm test` can import it directly
// (scripts/check-email.mjs). Sending lives in src/lib/email.ts.

// Absolute and PNG: Gmail blocks SVG and relative images. Served from public/brand on the site.
const EMAIL_LOGO_URL = "https://www.noswipe.app/brand/email-logo.png";

export type AdminLoginEmail = { subject: string; text: string; html: string };

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** `link` must be built from SITE_URL; `code` is the one-time code Supabase generated with it. */
export function buildAdminLoginEmail(link: string, code: string): AdminLoginEmail {
  const subject = "Your NoSwipe admin sign-in";
  const footer = "You're getting this because someone asked to sign in to NoSwipe admin with this address. If it wasn't you, ignore this email.";
  const expiry = "The link and code work once and expire in 1 hour.";

  const text = [
    "Sign in to NoSwipe admin.",
    "",
    "Open this link to sign in:",
    link,
    "",
    `Or enter this code on the sign-in page: ${code}`,
    "",
    expiry,
    "",
    "--",
    footer
  ].join("\n");

  const safeLink = escapeHtml(link);
  const safeCode = escapeHtml(code);
  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111111;">
<p style="margin:0 0 24px;"><img src="${EMAIL_LOGO_URL}" width="48" height="48" alt="NoSwipe" style="display:block;border:0;width:48px;height:48px;"></p>
<p style="margin:0 0 16px;font-size:22px;font-weight:700;">Sign in to NoSwipe admin.</p>
<p style="margin:0 0 24px;"><a href="${safeLink}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;border-radius:10px;">Sign in</a></p>
<p style="margin:0 0 8px;">Or enter this code on the sign-in page:</p>
<p style="margin:0 0 24px;font-size:28px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;">${safeCode}</p>
<p style="margin:0 0 32px;color:#444444;">${expiry}</p>
<p style="margin:0;font-size:13px;color:#666666;">${footer}</p>
</div>
</body>
</html>`;

  return { subject, text, html };
}
