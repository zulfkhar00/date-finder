import * as core from "@/lib/automation/core";
import { authorizeAutomation, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST -> mark a user message as sent in the app.
export async function POST(request: Request, ctx: { params: Promise<{ messageId: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  return respond(await core.ackOutbox(auth.sb, (await ctx.params).messageId));
}
