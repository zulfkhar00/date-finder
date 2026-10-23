import { after, NextResponse } from "next/server";
import { claimUpdate, handleUpdate, releaseUpdate } from "@/lib/concierge/intake";
import { safeErrorText, telegramConfigured, verifyWebhookSecret, type TelegramUpdate } from "@/lib/concierge/telegram";

export const runtime = "nodejs";

function supabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export async function POST(request: Request) {
  if (!telegramConfigured()) return NextResponse.json({ error: "Telegram intake is not configured" }, { status: 404 });
  if (!verifyWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ error: "Storage is not configured" }, { status: 503 });

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (typeof update?.update_id !== "number") return NextResponse.json({ ok: true });

  let claimed = false;
  try {
    if (!(await claimUpdate(update.update_id))) return NextResponse.json({ ok: true });
    claimed = true;
    const task = await handleUpdate(update);
    if (task) {
      after(async () => {
        try {
          await task();
        } catch (error) {
          console.error("Telegram update task failed", update.update_id, safeErrorText(error));
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Logged without message content. A 500 makes Telegram retry this update later.
    console.error("Telegram webhook failed", update.update_id, safeErrorText(error));
    if (claimed) await releaseUpdate(update.update_id).catch(() => undefined);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
