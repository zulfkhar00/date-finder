import * as core from "@/lib/automation/core";
import { authorizeAutomation, json, readJson, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {app, externalId?, name, age?, matchedAt?} -> ingest a match (idempotent on externalId).
export async function POST(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (body === undefined) return json({ ok: false, code: "invalid", message: "Bad JSON." }, 400);
  return respond(await core.addMatch(auth.sb, (await ctx.params).userId, body));
}
