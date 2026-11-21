"use client";

import { useState } from "react";
import { ConnectApps } from "@/components/app/step-fields";
import { connectionsReady, type Draft } from "@/lib/app/draft";
import { buildDemo } from "@/lib/app/demo-data";

export function DemoConnect() {
  const [d, setD] = useState<Draft>(() => ({ ...buildDemo().draft, apps: ["hinge", "tinder"], connections: { hinge: { handoff: "invite", consent: true }, tinder: { handoff: "operator_session", consent: false } } }));
  return (
    <div className="ob-body" style={{ padding: 0 }}>
      <h1>Connect your apps</h1>
      <p className="app-sub">Optional. Pick the apps you want NoSwipe to run for you: your profile, your swipes, your chats, your dates. You just show up.</p>
      <div style={{ marginTop: 22 }}><ConnectApps d={d} set={(patch) => setD((x) => ({ ...x, ...patch }))} /></div>
      <div style={{ marginTop: 26 }}><button type="button" className="app-btn" disabled={!connectionsReady(d)}>Continue</button></div>
    </div>
  );
}
