import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "../../_lib/auth";
import { readAdminConfig } from "../../_lib/config";

export const runtime = "nodejs";

// Magic-link landing. Supports both link shapes Supabase can send:
//  - ?code=…                      default template (PKCE; same browser that asked for the link)
//  - ?token_hash=…&type=email     custom template from DEPLOYMENT.md (works in any browser)
// Whether the signed-in email is an admin is decided by /admin itself (404 if not).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  // Behind the reverse proxy the request URL can carry the container's internal host.
  const origin = process.env.SITE_URL?.trim().replace(/\/+$/, "") || url.origin;
  const fail = () => NextResponse.redirect(new URL("/admin/login?error=link", origin));
  const { config } = readAdminConfig();
  if (!config) return NextResponse.redirect(new URL("/admin/login", origin));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  try {
    const supabase = await createAuthClient(config);
    if (tokenHash && (type === "email" || type === "magiclink")) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) {
        console.error("Admin link verification failed", error.code ?? error.status ?? "unknown");
        return fail();
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("Admin link exchange failed", error.code ?? error.status ?? "unknown");
        return fail();
      }
    } else {
      return fail();
    }
  } catch (error) {
    console.error("Admin link verification failed", error instanceof Error ? error.name : "unknown error");
    return fail();
  }
  return NextResponse.redirect(new URL("/admin", origin));
}
