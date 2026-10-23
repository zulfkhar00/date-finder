// PII scrub for everything the concierge stores as text: drafts.input_summary, drafts.output,
// operator notes and tracker notes. Removes email addresses, URLs (with or without a scheme),
// @handles and phone numbers. It runs on the server right before each insert or update, so no
// contact details from a screenshot, a draft or an operator's note reach the database.
//
// Deliberately blunt: a removed link in a date plan is a much smaller problem than a stored
// phone number. Dates (2026-10-23, 10/23/2026) and times (7:30) are left alone.

export const SCRUBBED = {
  email: "[email removed]",
  url: "[link removed]",
  handle: "[handle removed]",
  phone: "[phone removed]"
} as const;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const SCHEME_URL = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
// Bare domains such as instagram.com/name or t.me/name. Common TLDs only, so "e.g." or "Node.js" survive.
const BARE_DOMAIN = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|me|app|co|dev|ly|gg|tv|link|xyz|info|biz|uk|us|ca|au|de|fr|es|it|nl|ru|kz|ua|in|bio|page|site|online)\b(?:\/[^\s<>"')\]]*)?/gi;
const HANDLE = /(^|[^\w@])@[A-Za-z0-9_](?:[A-Za-z0-9_.]{0,29}[A-Za-z0-9_])?/g;
// Candidate phone numbers: 7+ digits with optional +, spaces, dots, dashes and parentheses.
const PHONE = /(?:\+|\b)\(?\d[\d\s().-]{5,}\d\b/g;
const DATE_LIKE = /^(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;

function scrubPhone(match: string): string {
  const digits = match.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return match;
  if (DATE_LIKE.test(match.trim())) return match;
  return SCRUBBED.phone;
}

/** Returns the text with contact details replaced by placeholders. */
export function scrubText(value: string): string {
  if (!value) return value;
  return value
    .replace(EMAIL, SCRUBBED.email)
    .replace(SCHEME_URL, SCRUBBED.url)
    .replace(BARE_DOMAIN, SCRUBBED.url)
    .replace(HANDLE, (_match, lead: string) => `${lead}${SCRUBBED.handle}`)
    .replace(PHONE, scrubPhone);
}

export function scrubNullable(value: string | null | undefined): string | null {
  return value == null ? null : scrubText(value);
}

/** Scrubs every string inside a JSON-like value (drafts.output). Keys are left as they are. */
export function scrubDeep<T>(value: T): T {
  if (typeof value === "string") return scrubText(value) as T;
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrubDeep(item)])) as T;
  }
  return value;
}
