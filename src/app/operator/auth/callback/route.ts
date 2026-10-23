import { NextResponse, type NextRequest } from "next/server";
import { startAdminSession, verifyAdminMagicLink } from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next") ?? "/operator";
  const safeNext = /^\/operator(\/[\w\-/]*)?(\?.*)?$/.test(next) ? next : "/operator";
  const email = await verifyAdminMagicLink({
    code: url.searchParams.get("code"),
    tokenHash: url.searchParams.get("token_hash"),
    type: url.searchParams.get("type")
  });
  const origin = (process.env.SITE_URL ?? url.origin).replace(/\/$/, "");
  if (!email) return NextResponse.redirect(`${origin}/operator/login?error=link`);
  await startAdminSession(email);
  return NextResponse.redirect(`${origin}${safeNext}`);
}
