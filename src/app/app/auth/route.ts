import { NextResponse, type NextRequest } from "next/server";
import { readAppConfig } from "@/lib/app/config";
import { isOwner, ownerAllowlist } from "@/lib/app/owner";
import { createAppClient } from "@/lib/app/session";

export const runtime = "nodejs";

// Landing for the emailed password-reset link (?token_hash=...&type=recovery). Signs the owner in just long enough
// to choose a new password; anyone who is not on the owner list is signed straight back out.
export async function GET(request: NextRequest) {
  const config = readAppConfig();
  if (!config) return new NextResponse(null, { status: 404 });
  const fail = () => NextResponse.redirect(new URL("/app/login?error=link", config.siteUrl));
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  if (!tokenHash || request.nextUrl.searchParams.get("type") !== "recovery") return fail();
  try {
    const supabase = await createAppClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    if (error || !data.user) return fail();
    if (!isOwner(data.user, ownerAllowlist())) {
      await supabase.auth.signOut({ scope: "local" });
      return fail();
    }
  } catch {
    return fail();
  }
  return NextResponse.redirect(new URL("/app/reset", config.siteUrl));
}
