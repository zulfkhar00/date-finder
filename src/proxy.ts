import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ADMIN_COOKIE_OPTIONS, readAdminConfig } from "@/lib/admin-config";
import { APP_COOKIE_OPTIONS, readAppConfig } from "@/lib/app/config";
import { decideHero, HERO_B_PATH, HERO_COOKIE, HERO_COOKIE_MAX_AGE } from "@/lib/hero-experiment";

// Home hero A/B: sticky 50/50 cookie, variant B is a rewrite (the URL stays "/"). The page itself must stay
// indexable, so this does not go through the admin/app handling below.
function heroExperiment(request: NextRequest) {
  const decision = decideHero({
    userAgent: request.headers.get("user-agent"),
    cookie: request.cookies.get(HERO_COOKIE)?.value,
    queryV: request.nextUrl.searchParams.get("v"),
    random: Math.random()
  });
  const response = decision.variant === "b" ? NextResponse.rewrite(new URL(HERO_B_PATH, request.url)) : NextResponse.next();
  if (decision.setCookie) {
    // Readable by the browser (not httpOnly) so event tracking can tag the variant; holds only "a" or "b".
    response.cookies.set(HERO_COOKIE, decision.variant, { maxAge: HERO_COOKIE_MAX_AGE, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  }
  // A response that varies per visitor must not be shared by a cache.
  if (decision.setCookie || decision.forced) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

// Runs for /admin, the owner preview (/app) and the signed-in app (/login, /onboarding, /home, /chats, /dates, /profile). Refreshes the Supabase Auth session cookie (Server Components cannot
// write cookies) and marks admin responses as not indexable. Authorization itself happens in
// every admin page, route handler and server action, not here.
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/") return heroExperiment(request);
  let response = NextResponse.next({ request });
  const isAdmin = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  const config = isAdmin ? readAdminConfig().config : readAppConfig();
  const cookieOptions = isAdmin ? ADMIN_COOKIE_OPTIONS : APP_COOKIE_OPTIONS;

  if (config) {
    try {
      const supabase = createServerClient(config.supabaseUrl, config.authKey, {
        cookieOptions,
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
      console.error("Session refresh failed", error instanceof Error ? error.name : "unknown error");
    }
  }

  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/", "/admin", "/admin/:path*", "/login", "/auth/:path*", "/onboarding", "/home", "/chats", "/chats/:path*", "/dates", "/dates/:path*", "/profile", "/profile/:path*", "/api/app/:path*", "/app", "/app/:path*"]
};
