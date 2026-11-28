import "server-only";
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APPS, effectiveStatus, type App, type AppStatus } from "@/lib/app/domain";
import { changeAppStatus } from "@/lib/fulfilment/service";
import { internalEmailReason } from "@/lib/internal-traffic";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { PACK_VERSION } from "@/lib/starter-pack/types";
import { generateKit, kitAllowed, listKits } from "./service";

// Automatic kit: a paid client with chosen apps gets their kit without an operator pressing "Generate kit". In-app state only:
// nothing here sends an email, a message or a notification. The reason the client reads is the existing "Needs you" line on their Home.

type Admin = SupabaseClient;
export const AUTO_KIT_ACTOR = "system:auto-kit";
/** A profile that has not changed for this long is as complete as it will get without a nudge; before that we wait for the starter pack. */
export const SETTLE_MINUTES = 30;
/** What the client reads on their Home until they confirm. Cleared by clearConsentRequest when they do. */
export const CONSENT_REASON = "Confirm you are 18 or older when the app asks, so we can start building your profile.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AutoKitOutcome =
  | { status: "created"; apps: App[]; handoff: App[] }
  | { status: "skipped"; reason: "invalid" | "not_paid" | "internal" | "no_apps" | "paused" | "kit_exists" | "not_ready" | "no_profile" | "error" };

/**
 * Makes the missing kits for one client. Safe to call any number of times and from any number of places at once:
 * an existing kit is never regenerated (operator edits stay), and the insert is refused by the unique key if another caller won.
 */
export async function ensureKits(sb: Admin, userId: string, now: Date = new Date()): Promise<AutoKitOutcome> {
  if (!UUID.test(userId)) return { status: "skipped", reason: "invalid" };
  const [{ data: accounts }, { data: profile }] = await Promise.all([
    sb.from("app_accounts").select("app, status, user_paused").eq("user_id", userId),
    sb.from("profiles").select("internal, updated_at").eq("user_id", userId).maybeSingle()
  ]);
  const rows = (accounts ?? []) as { app: string; status: AppStatus; user_paused: boolean }[];
  if (!rows.length) return { status: "skipped", reason: "no_apps" };
  if (!profile) return { status: "skipped", reason: "no_profile" };
  // Not paused by the client, not paused or closed by the team.
  const open = rows.filter((r) => (APPS as readonly string[]).includes(r.app) && !r.user_paused && !["paused", "closed"].includes(effectiveStatus(r)));
  if (!open.length) return { status: "skipped", reason: "paused" };

  const gate = await kitAllowed(sb, userId);
  // Internal and test accounts are left exactly as they are: their kit is made by hand when someone is testing.
  if (gate.internal || (gate.email && internalEmailReason(gate.email))) return { status: "skipped", reason: "internal" };
  if (!gate.paid) return { status: "skipped", reason: "not_paid" };

  const { kits } = await listKits(sb, userId);
  const missing = open.filter((r) => !kits[r.app as App]);
  if (!missing.length) return { status: "skipped", reason: "kit_exists" };

  // Wait for the starter pack (usually a minute) unless the profile has been quiet long enough that it is not coming.
  const { data: pack } = await sb.from("starter_packs").select("status").eq("user_id", userId).eq("version", PACK_VERSION).eq("status", "ready").maybeSingle();
  const quietFor = now.getTime() - new Date((profile.updated_at as string | null) ?? 0).getTime();
  if (!pack && quietFor < SETTLE_MINUTES * 60_000) return { status: "skipped", reason: "not_ready" };

  const created: App[] = [];
  for (const r of missing) {
    const result = await generateKit(sb, AUTO_KIT_ACTOR, userId, r.app, { onlyIfMissing: true });
    if (!result.ok) { if (created.length === 0 && result.code === "not_found") return { status: "skipped", reason: "no_profile" }; continue; }
    if (result.created) created.push(r.app as App);
  }
  if (!created.length) return { status: "skipped", reason: "kit_exists" };

  // Next step for the client, in the app only: if they never confirmed they are an adult, their Home says so.
  const handoff: App[] = [];
  const { data: consent } = await sb.from("consents").select("id").eq("user_id", userId).limit(1);
  if (!consent?.length) {
    for (const app of created) {
      const current = rows.find((r) => r.app === app)!;
      if (effectiveStatus(current) !== "setting_up") continue;
      const moved = await changeAppStatus(sb, AUTO_KIT_ACTOR, userId, app, { status: "needs_client_action", reason: CONSENT_REASON });
      if (moved.ok) handoff.push(app);
    }
  }
  return { status: "created", apps: created, handoff };
}

/** The client confirmed: the consent request goes away and the app is back to the team's setup. Other reasons are never touched. */
export async function clearConsentRequest(sb: Admin, userId: string): Promise<number> {
  const { data } = await sb.from("app_accounts").select("app").eq("user_id", userId).eq("status", "needs_client_action").eq("client_action_reason", CONSENT_REASON);
  let cleared = 0;
  for (const r of (data ?? []) as { app: string }[]) {
    const res = await changeAppStatus(sb, AUTO_KIT_ACTOR, userId, r.app, { status: "setting_up", note: "Client confirmed consent." });
    if (res.ok) cleared += 1;
  }
  return cleared;
}

/** Every client who is setting up and has no kit yet. Bounded per run; the rest are picked up by the next run. */
export async function sweepKits(sb: Admin, opts: { limit?: number; now?: Date } = {}): Promise<{ checked: number; created: number; apps: number; skipped: Record<string, number> }> {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const { data } = await sb.from("app_accounts").select("user_id, app").in("status", ["setting_up", "awaiting_login", "needs_client_action"]).eq("user_paused", false).limit(1000);
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  const { data: have } = ids.length ? await sb.from("account_kits").select("user_id, app").in("user_id", ids) : { data: [] };
  const done = new Set(((have ?? []) as { user_id: string; app: string }[]).map((k) => `${k.user_id}:${k.app}`));
  const todo = [...new Set(((data ?? []) as { user_id: string; app: string }[]).filter((r) => !done.has(`${r.user_id}:${r.app}`)).map((r) => r.user_id))];
  const out = { checked: 0, created: 0, apps: 0, skipped: {} as Record<string, number> };
  for (const id of todo.slice(0, limit)) {
    out.checked += 1;
    try {
      const r = await ensureKits(sb, id, opts.now);
      if (r.status === "created") { out.created += 1; out.apps += r.apps.length; } else out.skipped[r.reason] = (out.skipped[r.reason] ?? 0) + 1;
    } catch {
      out.skipped.error = (out.skipped.error ?? 0) + 1;
    }
  }
  return out;
}

/** After the response: never blocks a request and never throws. The sweep covers anything this misses. */
export function scheduleAutoKit(userId: string): void {
  try {
    after(async () => { await ensureKits(getSupabaseAdmin(), userId).catch(() => undefined); });
  } catch { /* outside a request scope: the sweep picks the client up */ }
}

/** Payment confirmed: find the client by email (they may not have an account yet; then there is nothing to do and the sweep covers it later). */
export function scheduleAutoKitForEmail(email: string): void {
  try {
    after(async () => {
      const sb = getSupabaseAdmin();
      const wanted = email.trim().toLowerCase();
      for (let page = 1; page <= 10; page++) {
        const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
        if (error || !data) return;
        const hit = data.users.find((u) => u.email?.toLowerCase() === wanted);
        if (hit) { await ensureKits(sb, hit.id).catch(() => undefined); return; }
        if (data.users.length < 1000) return;
      }
    });
  } catch { /* the sweep covers it */ }
}
