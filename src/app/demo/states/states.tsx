"use client";

import { AccountCards } from "@/components/app/accounts";
import type { AppAccountRow } from "@/lib/app/domain";
import type { ActivityRow } from "@/lib/app/activity";
import { demoAccountApi } from "../demo-screens";


// Every state an account card can be in, with sample data. For review only: linked from nowhere, not indexed.
export function DemoStates({ now, activity }: { now: number; activity: ActivityRow[] }) {
  const d = { now, activity };
  const base = { user_paused: false };
  const paid = { paid: true, hoursWaiting: 5 };
  const section = (title: string, apps: AppAccountRow[], ctx: Parameters<typeof AccountCards>[0]["ctx"], activity: typeof d.activity | null) => (
    <section style={{ marginTop: 22 }} aria-label={title}>
      <h2 className="app-h2">{title}</h2>
      <AccountCards apps={apps} ctx={ctx} activity={activity} nowMs={d.now} base="/demo" api={demoAccountApi} hasChatsByApp={{ tinder: true, hinge: true, bumble: true }} />
    </section>
  );
  return (
    <>
      <h1 className="app-h1">Account states</h1>
      <p className="app-sub">Every state of an account card, with sample data.</p>
      {section("Setting up: we are creating your profile", [
        { app: "tinder", status: "setting_up", ...base },
        { app: "hinge", status: "setting_up", ...base }
      ], paid, d.activity)}
      {section("Needs you: we need a new photo or a verification selfie", [
        { app: "bumble", status: "needs_client_action", ...base, client_action_reason: "Bumble asked for a verification selfie. Add a clear, recent photo of your face in Profile" }
      ], paid, d.activity)}
      {section("Running with nothing reported yet today", [{ app: "tinder", status: "active", ...base }], paid, [])}
      {section("Running, but no activity feed yet", [{ app: "hinge", status: "active", ...base }], paid, null)}
      {section("Paused by you, and paused by our team", [
        { app: "tinder", status: "active", ...base, user_paused: true },
        { app: "bumble", status: "paused", ...base }
      ], paid, d.activity)}
      {section("Not started yet (not activated)", [{ app: "hinge", status: "setting_up", ...base }], { paid: false, paidOffered: true }, null)}
      {section("Your country isn't supported yet", [{ app: "tinder", status: "setting_up", ...base }], { paid: false, paidOffered: false }, null)}
      {section("Taking longer than 72 hours", [{ app: "bumble", status: "setting_up", ...base }], { paid: true, hoursWaiting: 90 }, null)}
    </>
  );
}
