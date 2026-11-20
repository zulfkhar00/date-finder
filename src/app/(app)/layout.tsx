import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import { HoldNotice, type HoldNoticeView } from "@/components/app/hold-notice";
import { Live } from "@/components/app/use-live";
import { ensureProfile } from "@/lib/app/actions-core";
import { createAppClient, requireUser } from "@/lib/app/session";
import { getHoldNotice } from "@/lib/reports/service";
import { APPEAL_WINDOW_MS } from "@/lib/reports/core";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: { default: "NoSwipe", template: "%s — NoSwipe" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  await ensureProfile(getSupabaseAdmin(), user.id, user.email);
  const sb = await createAppClient();
  const { data: profile } = await sb.from("profiles").select("onboarding_done_at").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_done_at) redirect("/onboarding");
  // A pause or closure that followed a report. Read separately so the app works before supabase/2026-11-20-reports.sql is applied.
  const hold = await getHoldNotice(user.id).catch(() => null);
  const notice: HoldNoticeView | null = hold ? {
    hold: hold.hold, ref: hold.ref, since: hold.since, deadline: new Date(new Date(hold.since).getTime() + APPEAL_WINDOW_MS).toISOString(),
    appeal: hold.appeal.kind === "can_appeal" ? "can_appeal" : hold.appeal.kind === "submitted" ? "submitted" : hold.appeal.kind === "expired" ? "expired" : "decided_upheld"
  } : null;
  const { count } = await sb.from("matches").select("id", { count: "exact", head: true }).eq("needs_user", true);
  // Closed: the notice replaces the app. Paused: the notice sits on top of the (read-only in effect) app.
  return <AppShell needsYou={count ?? 0} live={<Live />} banner={notice ? <HoldNotice notice={notice} /> : undefined}>{notice?.hold === "closed" ? null : children}</AppShell>;
}
