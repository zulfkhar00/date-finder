import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE_OPTIONS, readAdminConfig } from "@/lib/admin-config";

// Runs only for /admin. Refreshes the Supabase Auth session cookie (Server Components cannot
// write cookies) and marks admin responses as not indexable. Authorization itself happens in
// every admin page, route handler and server action, not here.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { config } = readAdminConfig();

  if (config) {
    try {
      const supabase = createServerClient(config.supabaseUrl, config.authKey, {
        cookieOptions: ADMIN_COOKIE_OPTIONS,
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (toSet, headers) => {
            for (const { name, value } of toSet) request.cookies.set(name, value);
            response = NextResponse.next({ request });
            for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
            for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
          }
        }
      });
      await supabase.auth.getUser();
    } catch (error) {
      console.error("Admin session refresh failed", error instanceof Error ? error.name : "unknown error");
    }
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"]
};
