// App (end-user) auth configuration. No "server-only" import: src/proxy.ts uses it too.
// Same Supabase project as /admin but a separate cookie (name + path), so a user session and a
// founder session never mix. Keys are server env only; nothing here is NEXT_PUBLIC_.
import { parseSiteUrl } from "@/lib/admin-config";

export type AppConfig = { supabaseUrl: string; authKey: string; siteUrl: string };

export function readAppConfig(): AppConfig | null {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const authKey = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY)?.trim();
  const siteUrl = parseSiteUrl(process.env.SITE_URL);
  if (!supabaseUrl || !authKey || !siteUrl) return null;
  return { supabaseUrl, authKey, siteUrl };
}

export const APP_COOKIE_OPTIONS = {
  name: "ns-session",
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 30
};

export const APP_PATH_PREFIXES = ["/login", "/onboarding", "/home", "/chats", "/dates", "/profile", "/auth", "/api/app"];
