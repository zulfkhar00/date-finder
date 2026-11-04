import * as core from "@/lib/automation/core";
import { authorizeAutomation, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET -> messages the user typed after taking over, waiting to be sent inside the dating app.
export async function GET(request: Request) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  return respond(await core.listOutbox(auth.sb));
}
