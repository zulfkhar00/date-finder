import * as core from "@/lib/automation/core";
import { authorizeAutomation, json, readJson, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PUT {status: "setting_up"|"live"|"paused"} -> create the app account row or report its status.
export async function PUT(request: Request, ctx: { params: Promise<{ userId: string; app: string }> }) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (body === undefined) return json({ ok: false, code: "invalid", message: "Bad JSON." }, 400);
  const { userId, app } = await ctx.params;
  return respond(await core.setAppStatus(auth.sb, userId, app, body));
}
