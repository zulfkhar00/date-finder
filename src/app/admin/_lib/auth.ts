import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE_OPTIONS, isAdminEmail, readAdminConfig, type AdminConfig } from "./config";

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

/** Who is asking, checked against ADMIN_EMAILS. Cached per request. */
export const getAdminState = cache(async (): Promise<AdminState> => {
  // Always render per request: env is read at runtime (Dokploy), never baked in at build time.
  await connection();
  const { config, missing } = readAdminConfig();
  if (!config) return { kind: "unconfigured", missing };

  try {
    const supabase = await createAuthClient(config);
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return { kind: "anonymous" };
    const email = data.user.email?.toLowerCase();
    if (!email || !isAdminEmail(config, email)) return { kind: "forbidden" };
    return { kind: "admin", email };
  } catch (error) {
    console.error("Admin auth check failed", error instanceof Error ? error.name : "unknown error");
    return { kind: "anonymous" };
  }
});

/**
 * For admin pages. Returns the admin email, or the setup state for the page to render.
 * Signed out → /admin/login. Signed in but not allowlisted → 404.
 */
export async function requireAdminPage(): Promise<{ email: string } | { unconfigured: string[] }> {
  const state = await getAdminState();
  if (state.kind === "admin") return { email: state.email };
  if (state.kind === "unconfigured") return { unconfigured: state.missing };
  if (state.kind === "anonymous") redirect("/admin/login");
  notFound();
}

/** For admin route handlers and server actions: the admin email, or null (respond 404). */
export async function adminEmailOrNull(): Promise<string | null> {
  const state = await getAdminState();
  return state.kind === "admin" ? state.email : null;
}
