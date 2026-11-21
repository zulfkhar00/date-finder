import { NextResponse, type NextRequest } from "next/server";
import { readAppConfig } from "@/lib/app/config";
import { createAppClient } from "@/lib/app/session";
import { recordFirstConfirmation } from "@/lib/signups";

export const runtime = "nodejs";

// Landing for the emailed sign-in link (?token_hash=…&type=email). Works in any browser.
export async function GET(request: NextRequest) {
  const config = readAppConfig();
  if (!config) return new NextResponse(null, { status: 307, headers: { Location: "/login" } });
  const fail = () => NextResponse.redirect(new URL("/login?error=link", config.siteUrl));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (!tokenHash || (type !== "email" && type !== "magiclink")) return fail();
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error("Sign-in link failed", error.code ?? error.status ?? "unknown");
      return fail();
    }
    if (data.user) await recordFirstConfirmation(data.user); // first confirmation via the emailed link; never blocks sign-in
  } catch {
    return fail();
  }
  return NextResponse.redirect(new URL("/home", config.siteUrl));
}
