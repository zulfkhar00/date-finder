import * as core from "@/lib/automation/core";
import { authorizeAutomation, json, readJson, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {needsUser: boolean, reason?} -> flag a chat for the user ("needs you" on /home) and email them once.
export async function POST(request: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (body === undefined) return json({ ok: false, code: "invalid", message: "Bad JSON." }, 400);
  return respond(await core.setNeedsYou(auth.sb, (await ctx.params).matchId, body));
}
