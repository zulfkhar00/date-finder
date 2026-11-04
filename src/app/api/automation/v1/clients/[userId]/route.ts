import * as core from "@/lib/automation/core";
import { authorizeAutomation, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET -> everything the worker needs to build the profile: answers, preferences, photos (1 h signed URLs), consent.
export async function GET(request: Request, ctx: { params: Promise<{ userId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  return respond(await core.clientBrief(auth.sb, (await ctx.params).userId));
}
