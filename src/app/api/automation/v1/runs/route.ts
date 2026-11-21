import { listRuns } from "@/lib/activity/service";
import { authorizeAutomation, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /runs?phoneId=pi-rack-1-phone-3 -> the rig's job list: which client app runs on which phone, and whether it should run right now.
export async function GET(request: Request) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit") ?? "");
  return respond(await listRuns(auth.sb, { phoneId: params.get("phoneId") ?? undefined, limit: Number.isFinite(limit) && limit > 0 ? limit : undefined }));
}
