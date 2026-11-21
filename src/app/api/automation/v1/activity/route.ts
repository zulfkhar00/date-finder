import { ingestEvents } from "@/lib/activity/service";
import { authorizeAutomation, json, readJson, respond } from "@/lib/automation/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST {userId, events: [{kind, app, idempotencyKey, occurredAt?, ...}]} -> records what the phone rig did for one client.
// Idempotent per (userId, idempotencyKey). See docs/automation.md "Activity feed".
export async function POST(request: Request) {
  const auth = authorizeAutomation(request);
  if (auth.error) return auth.error;
  const body = await readJson(request);
  if (body === undefined || body === null || typeof body !== "object") return json({ ok: false, code: "invalid", message: "Bad JSON." }, 400);
  const { userId, ...rest } = body as { userId?: unknown };
  if (typeof userId !== "string") return json({ ok: false, code: "invalid", message: "userId is required." }, 400);
  return respond(await ingestEvents(auth.sb, userId, rest));
}
