// Admin configuration from server env. No "server-only" import here because src/proxy.ts uses
// it too; nothing in this file is a secret on its own, and none of it is NEXT_PUBLIC_.

export type AdminConfig = {
  supabaseUrl: string;
  /** Publishable (or legacy anon) key, used only server-side for Supabase Auth sessions. */
  authKey: string;
  adminEmails: ReadonlySet<string>;
};

export function readAdminConfig(): { config: AdminConfig | null; missing: string[] } {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const authKey = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim();
  const serviceKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  const missing: string[] = [];
  if (!supabaseUrl) missing.push("SUPABASE_URL");
  if (!serviceKey) missing.push("SUPABASE_SECRET_KEY");
  if (!authKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
  if (adminEmails.size === 0) missing.push("ADMIN_EMAILS");

  if (missing.length > 0 || !supabaseUrl || !authKey) return { config: null, missing };
  return { config: { supabaseUrl, authKey, adminEmails }, missing };
}

export function parseAdminEmails(raw: string | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.includes("@"))
  );
}

export function isAdminEmail(config: AdminConfig, email: string | null | undefined): boolean {
  return typeof email === "string" && config.adminEmails.has(email.trim().toLowerCase());
}

// Auth cookies are scoped to /admin, httpOnly (no browser Supabase client exists), and expire
// after 14 days even if Supabase would keep the refresh token alive longer.
export const ADMIN_COOKIE_OPTIONS = {
  path: "/admin",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 14
};
