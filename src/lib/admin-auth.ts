import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { ADMIN_COOKIE_OPTIONS, isAdminEmail, readAdminConfig, type AdminConfig } from "@/lib/admin-config";

// Shared founder auth for everything under /admin (dashboard, leads, clients, videos).
// One Supabase Auth session, one login page (/admin/login), one callback (/admin/auth/callback),
// one cookie path (/admin). Every page, route handler and server action calls one of the
// helpers below itself; layouts and src/proxy.ts are never relied on for access control.

export type AdminState =
  | { kind: "unconfigured"; missing: string[] }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "admin"; email: string };

/** Supabase Auth client bound to this request's cookies. Never uses the service key. */
export async function createAuthClient(config: AdminConfig) {
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.authKey, {
    cookieOptions: ADMIN_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session instead.
        }
      }
    },
    global: { headers: { "X-Client-Info": "noswipe-admin" } }
  });
}

/**
 * The admin email for a Supabase user, or null. Requires a confirmed email address AND an
 * ADMIN_EMAILS match, so an unconfirmed account that claims a founder's address never passes.
 */
export function adminEmailForUser(config: AdminConfig, user: User | null | undefined): string | null {
  if (!user?.email_confirmed_at) return null;
  const email = user.email?.trim().toLowerCase();
  if (!email || !isAdminEmail(config, email)) return null;
  return email;
}

/** Who is asking, checked against a confirmed email + ADMIN_EMAILS. Cached per request. */
export const getAdminState = cache(async (): Promise<AdminState> => {
  // Always render per request: env is read at runtime (Dokploy), never baked in at build time.
  await connection();
  const { config, missing } = readAdminConfig();
  if (!config) return { kind: "unconfigured", missing };

  try {
    const supabase = await createAuthClient(config);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { kind: "anonymous" };
    const email = adminEmailForUser(config, data.user);
    if (!email) return { kind: "forbidden" };
    return { kind: "admin", email };
  } catch (error) {
    console.error("Admin auth check failed", error instanceof Error ? error.name : "unknown error");
    return { kind: "anonymous" };
  }
});

/**
 * For admin pages. Returns the admin email, or the setup state for the page to render.
 * Signed out → /admin/login. Signed in but not an admin → 404.
 */
export async function requireAdminPage(): Promise<{ email: string } | { unconfigured: string[] }> {
  const state = await getAdminState();
  if (state.kind === "admin") return { email: state.email };
  if (state.kind === "unconfigured") return { unconfigured: state.missing };
  if (state.kind === "anonymous") redirect("/admin/login");
  notFound();
}

/** For admin route handlers and server actions: the admin email, or null (respond 404 / refuse). */
export async function adminEmailOrNull(): Promise<string | null> {
  const state = await getAdminState();
  return state.kind === "admin" ? state.email : null;
}
