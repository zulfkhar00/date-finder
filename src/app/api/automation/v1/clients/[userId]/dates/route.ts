import * as core from "@/lib/automation/core";
import { authorizeAutomation, json, readJson, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {matchId?, who, venue, address?, startsAt, summary?} -> book a date; shows up on /dates and emails the user.
export async function POST(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (body === undefined) return json({ ok: false, code: "invalid", message: "Bad JSON." }, 400);
  return respond(await core.bookDate(auth.sb, (await ctx.params).userId, body));
}
