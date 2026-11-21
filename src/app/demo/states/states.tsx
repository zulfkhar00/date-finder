"use client";

import { AccountCards } from "@/components/app/accounts";
import type { AppAccountRow } from "@/lib/app/domain";
import type { ActivityRow } from "@/lib/app/activity";
import { demoAccountApi } from "../demo-screens";


// Every state an account card can be in, with sample data. For review only: linked from nowhere, not indexed.
export function DemoStates({ now, activity }: { now: number; activity: ActivityRow[] }) {
  const d = { now, activity };
  const base = { user_paused: false, handoff_method: "operator_session" as const };
  const paid = { paid: true, hoursWaiting: 5 };
  const login = new Date(d.now + 26 * 3600000).toISOString();
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
      {section("Before it runs: waiting for login, setting up, needs you", [
        { app: "tinder", status: "awaiting_login", ...base, login_scheduled_at: login },
        { app: "hinge", status: "setting_up", ...base },
        { app: "bumble", status: "needs_client_action", ...base, client_action_reason: "Bumble asked you to verify your phone number. Open the app and enter the code it texts you" }
      ], paid, d.activity)}
      {section("Waiting for an invite, and a login nobody has scheduled yet", [
        { app: "tinder", status: "awaiting_login", ...base, handoff_method: "invite" },
        { app: "hinge", status: "awaiting_login", ...base }
      ], paid, d.activity)}
      {section("Running with nothing reported yet today", [{ app: "tinder", status: "active", ...base }], paid, [])}
      {section("Running, but no activity feed yet", [{ app: "hinge", status: "active", ...base }], paid, null)}
      {section("Paused by you, and paused by our team", [
        { app: "tinder", status: "active", ...base, user_paused: true },
        { app: "bumble", status: "paused", ...base }
      ], paid, d.activity)}
      {section("Not started yet (not activated)", [{ app: "hinge", status: "awaiting_login", ...base }], { paid: false, paidOffered: true }, null)}
      {section("Your country isn't supported yet", [{ app: "tinder", status: "awaiting_login", ...base }], { paid: false, paidOffered: false }, null)}
      {section("Taking longer than 72 hours", [{ app: "bumble", status: "awaiting_login", ...base }], { paid: true, hoursWaiting: 90 }, null)}
    </>
  );
}
