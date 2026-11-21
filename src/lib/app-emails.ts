// Content of the emails the app sends: sign-in code, date booked, chat needs you. Pure and
// dependency-free so `npm test` can import it. Sending lives in src/lib/email.ts.
// Notification emails never contain message text, only the match's first name and a link.

const EMAIL_LOGO_URL = "https://www.noswipe.app/brand/email-logo.png";
export type AppEmail = { subject: string; text: string; html: string };

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function shell(heading: string, bodyHtml: string, footer: string): string {
  return `<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:480px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#111111;">
<p style="margin:0 0 24px;"><img src="${EMAIL_LOGO_URL}" width="48" height="48" alt="NoSwipe" style="display:block;border:0;width:48px;height:48px;"></p>
<p style="margin:0 0 16px;font-size:22px;font-weight:700;">${esc(heading)}</p>
${bodyHtml}
<p style="margin:32px 0 0;font-size:13px;color:#666666;">${esc(footer)}</p>
</div></body></html>`;
}
function button(href: string, label: string): string {
  return `<p style="margin:0 0 24px;"><a href="${esc(href)}" style="display:inline-block;padding:12px 22px;background:#111111;color:#ffffff;text-decoration:none;font-weight:600;border-radius:10px;">${esc(label)}</a></p>`;
}

export function buildLoginEmail(link: string, code: string): AppEmail {
  const footer = "You're getting this because someone asked to sign in to NoSwipe with this address. If it wasn't you, ignore this email.";
  const text = ["Sign in to NoSwipe.", "", "Open this link:", link, "", `Or enter this code: ${code}`, "", "The link and code work once and expire in 1 hour.", "", "--", footer].join("\n");
  const html = shell("Sign in to NoSwipe.", `${button(link, "Sign in")}<p style="margin:0 0 8px;">Or enter this code on the sign-in page:</p><p style="margin:0 0 24px;font-size:28px;font-weight:700;letter-spacing:4px;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(code)}</p><p style="margin:0;color:#444444;">The link and code work once and expire in 1 hour.</p>`, footer);
  return { subject: "Your NoSwipe sign-in", text, html };
}

export function buildResetEmail(link: string): AppEmail {
  const footer = "You're getting this because a password reset was requested for this address. If it wasn't you, ignore this email.";
  const text = ["Reset your NoSwipe password.", "", "Open this link:", link, "", "It works once and expires in 1 hour.", "", "--", footer].join("\n");
  const html = shell("Reset your password.", `${button(link, "Choose a new password")}<p style="margin:0;color:#444444;">The link works once and expires in 1 hour.</p>`, footer);
  return { subject: "Reset your NoSwipe password", text, html };
}

const NOTIFY_FOOTER = "You can turn these emails off any time in Profile → Notifications.";

export function formatWhen(iso: string, timeZone = "UTC"): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone, timeZoneName: "short" });
}

export function buildDateBookedEmail(input: { who: string; venue: string; startsAt: string; link: string }): AppEmail {
  const when = formatWhen(input.startsAt);
  const text = [`You have a date with ${input.who}.`, "", `${input.venue}`, when, "", "See the details and add it to your calendar:", input.link, "", "--", NOTIFY_FOOTER].join("\n");
  const html = shell(`You have a date with ${input.who}.`, `<p style="margin:0 0 4px;font-weight:600;">${esc(input.venue)}</p><p style="margin:0 0 24px;">${esc(when)}</p>${button(input.link, "See the details")}`, NOTIFY_FOOTER);
  return { subject: `Date booked: ${input.who}`, text, html };
}

export function buildNeedsYouEmail(input: { who: string; link: string }): AppEmail {
  const text = [`Your chat with ${input.who} needs you.`, "", "Open the chat to take over, or leave it with us:", input.link, "", "--", NOTIFY_FOOTER].join("\n");
  const html = shell(`Your chat with ${input.who} needs you.`, `<p style="margin:0 0 24px;">Open the chat to take over, or leave it with us.</p>${button(input.link, "Open the chat")}`, NOTIFY_FOOTER);
  return { subject: `${input.who} needs you`, text, html };
}
