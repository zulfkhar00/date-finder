import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { APP_COOKIE_OPTIONS, readAppConfig } from "./config";

/** Supabase client bound to the user's own session cookie. Reads through it are subject to RLS. */
export async function createAppClient() {
  const config = readAppConfig();
  if (!config) throw new Error("App auth is not configured");
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.authKey, {
    cookieOptions: APP_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot set cookies; src/proxy.ts refreshes the session.
        }
      }
    },
    global: { headers: { "X-Client-Info": "noswipe-app" } }
  });
}

export const getAppUser = cache(async (): Promise<User | null> => {
  await connection();
  if (!readAppConfig()) return null;
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.email_confirmed_at) return null;
    return data.user;
  } catch {
    return null;
  }
});

/** For pages and actions: the signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getAppUser();
  if (!user) redirect("/login");
  return user;
}

/** For server actions and route handlers: the user or null (never redirects). */
export async function userOrNull(): Promise<User | null> {
  return getAppUser();
}
