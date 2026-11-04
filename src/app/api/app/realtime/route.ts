import { NextResponse } from "next/server";
import { readAppConfig } from "@/lib/app/config";
import { createAppClient, userOrNull } from "@/lib/app/session";

export const runtime = "nodejs";

// The signed-in browser asks for its own short-lived access token to open a Realtime channel.
// The token is the user's, so Postgres RLS limits the stream to their rows. The publishable key is
// public by design (Supabase ships it to browsers); it is handed out at runtime, never NEXT_PUBLIC.
export async function GET() {
  const config = readAppConfig();
  const user = await userOrNull();
  if (!config || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const supabase = await createAppClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { url: config.supabaseUrl, key: config.authKey, token: data.session.access_token, userId: user.id, expiresAt: data.session.expires_at ?? null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
