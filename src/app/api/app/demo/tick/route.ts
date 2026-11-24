import { NextResponse } from "next/server";
import { userOrNull } from "@/lib/app/session";
import { tickDemo } from "@/lib/demo/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createAnthropicModel } from "@/lib/starter-pack/anthropic-model";

export const runtime = "nodejs";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Live demo mode: the open page of an INTERNAL account calls this every ~10 s. The server decides whether anything happens (demo mode
 * on, the last action long enough ago, this call wins the lock). Anyone else, signed in or not, gets a plain 404, so the route does not
 * reveal itself. The model call is short-timeout and capped per day inside tickDemo; the key never leaves the server.
 */
export async function POST(request: Request) {
  const user = await userOrNull();
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("profiles").select("internal").eq("user_id", user.id).maybeSingle();
  if (!data?.internal) return NextResponse.json({ error: "not_found" }, { status: 404, headers: NO_STORE });
  let timezone: string | null = null;
  try { const body = (await request.json()) as { timezone?: unknown }; timezone = typeof body.timezone === "string" ? body.timezone : null; } catch { /* no body */ }
  const result = await tickDemo(sb, user.id, { timezone, model: createAnthropicModel(undefined, 9_000) });
  return NextResponse.json(result, { headers: NO_STORE });
}
