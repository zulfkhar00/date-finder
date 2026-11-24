/** Client time zones: IANA names only ("America/Los_Angeles", "UTC"), checked on the server. Never trust the browser's value. */

const SHAPE = /^(UTC|[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2})$/;

export function isIanaTimezone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length > 64 || !SHAPE.test(tz)) return false; // rules out "EST", "+01:00", "utc ", and anything with spaces
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The zone as stored (canonical casing from Intl), or null for anything that is not a real IANA name. */
export function normalizeTimezone(tz: unknown): string | null {
  if (typeof tz !== "string") return null;
  const t = tz.trim();
  if (!isIanaTimezone(t)) return null;
  try { return new Intl.DateTimeFormat("en-US", { timeZone: t }).resolvedOptions().timeZone; } catch { return null; }
}
