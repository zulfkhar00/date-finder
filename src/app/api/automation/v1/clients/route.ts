import * as core from "@/lib/automation/core";
import { authorizeAutomation, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/automation/v1/clients?status=setting_up  -> app accounts the worker should act on.
export async function GET(request: Request) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const status = new URL(request.url).searchParams.get("status") ?? undefined;
  return respond(await core.listClients(auth.sb, { status }));
}
