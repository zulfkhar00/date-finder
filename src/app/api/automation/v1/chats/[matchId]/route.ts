import { NextResponse } from "next/server";
import * as core from "@/lib/automation/core";
import { authorizeAutomation, json } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET -> chat state (mode, app status) and the last 100 messages, so a worker can draft the next reply.
export async function GET(request: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const { matchId } = await ctx.params;
  const state = await core.chatState(auth.sb, matchId);
  if (!state) return json({ ok: false, code: "not_found", message: "Unknown chat." }, 404);
  const { data } = await auth.sb.from("messages").select("id, sender, body, sent_at").eq("match_id", matchId).neq("sender", "system_internal").order("sent_at", { ascending: false }).limit(100);
  return NextResponse.json({ ok: true, chat: { id: matchId, userId: state.match.user_id, app: state.match.app, name: state.match.name, mode: state.mode, appStatus: state.appStatus, aiMaySend: state.mode === "ai" && state.appStatus !== "paused" }, messages: (data ?? []).reverse() }, { headers: { "Cache-Control": "no-store" } });
}
