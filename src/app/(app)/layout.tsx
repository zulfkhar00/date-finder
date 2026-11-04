import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/shell";
import { Live } from "@/components/app/use-live";
import { ensureProfile } from "@/lib/app/actions-core";
import { createAppClient, requireUser } from "@/lib/app/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const metadata: Metadata = { title: { default: "NoSwipe", template: "%s — NoSwipe" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  await ensureProfile(getSupabaseAdmin(), user.id, user.email);
  const sb = await createAppClient();
  const { data: profile } = await sb.from("profiles").select("onboarding_done_at").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_done_at) redirect("/onboarding");
  const { count } = await sb.from("matches").select("id", { count: "exact", head: true }).eq("needs_user", true);
  return <AppShell needsYou={count ?? 0} live={<Live />}>{children}</AppShell>;
}
