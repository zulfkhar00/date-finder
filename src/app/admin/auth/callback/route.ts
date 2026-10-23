import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { adminEmailForUser, createAuthClient } from "@/lib/admin-auth";
import { readAdminConfig } from "@/lib/admin-config";

export const runtime = "nodejs";

// Magic-link landing for every founder-only surface under /admin. Supports both link shapes:
//  - ?code=…                      default template (PKCE; same browser that asked for the link)
//  - ?token_hash=…&type=email     custom template from DEPLOYMENT.md (works in any browser)
// The session is kept only for a confirmed, allowlisted email; every /admin page checks again.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const { config } = readAdminConfig();
  // Not configured (SITE_URL included): the login page shows the setup notice. Relative Location,
  // so no host from the request is ever echoed back.
  if (!config) return new NextResponse(null, { status: 307, headers: { Location: "/admin/login" } });
  // Behind the reverse proxy the request URL can carry the container's internal host: use SITE_URL.
  const fail = () => NextResponse.redirect(new URL("/admin/login?error=link", config.siteUrl));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  try {
    const supabase = await createAuthClient(config);
    let user: User | null = null;
    if (tokenHash && (type === "email" || type === "magiclink")) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        console.error("Admin link verification failed", error.code ?? error.status ?? "unknown");
        return fail();
      }
      user = data.user;
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Admin link exchange failed", error.code ?? error.status ?? "unknown");
        return fail();
      }
      user = data.user;
    } else {
      return fail();
    }
    if (!adminEmailForUser(config, user)) {
      // Unconfirmed or not allowlisted: don't keep the session.
      await supabase.auth.signOut();
      return fail();
    }
  } catch (error) {
    console.error("Admin link verification failed", error instanceof Error ? error.name : "unknown error");
    return fail();
  }
  return NextResponse.redirect(new URL("/admin", config.siteUrl));
}
