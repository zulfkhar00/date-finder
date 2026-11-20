"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles, UserPlus } from "lucide-react";
import { ProfileClient } from "@/components/app/profile-client";
import { previewTools, profileApi } from "@/components/app/mock/actions";
import { ageFromBirthday } from "@/lib/app/domain";
import { useMock } from "@/lib/app/mock-store";

/** Owner-only controls: start the walkthrough over, or look at the empty states. */
function PreviewTools() {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  async function run(key: string, fn: () => void, to?: string) {
    if (busy) return;
    setBusy(key);
    await new Promise((r) => setTimeout(r, 300));
    fn();
    if (to) router.push(to);
    setBusy("");
  }
  return (
    <section className="app-card" aria-label="Preview tools" style={{ marginTop: 14 }}>
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>Preview tools</h2>
      <p className="app-fine" style={{ marginTop: 4 }}>Only you can see this page. Everything is sample data kept in this browser; nothing is saved to a real account or sent to anyone.</p>
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        <button type="button" className="app-btn ghost" disabled={busy !== ""} aria-busy={busy === "replay"} onClick={() => run("replay", previewTools.replayOnboarding, "/app/onboarding")}>
          {busy === "replay" ? <><span className="app-spinner" aria-hidden /> Starting…</> : <><UserPlus size={18} aria-hidden /> Replay from onboarding</>}
        </button>
        <button type="button" className="app-btn ghost" disabled={busy !== ""} aria-busy={busy === "empty"} onClick={() => run("empty", previewTools.emptyStates, "/app")}>
          {busy === "empty" ? <><span className="app-spinner" aria-hidden /> Loading…</> : <><Sparkles size={18} aria-hidden /> Show the empty states</>}
        </button>
        <button type="button" className="app-btn ghost" disabled={busy !== ""} aria-busy={busy === "reset"} onClick={() => run("reset", previewTools.resetSample, "/app")}>
          {busy === "reset" ? <><span className="app-spinner" aria-hidden /> Resetting…</> : <><RotateCcw size={18} aria-hidden /> Reset the sample data</>}
        </button>
      </div>
    </section>
  );
}

export function MockProfile() {
  const s = useMock();
  const router = useRouter();
  const api = useMemo(() => profileApi(() => router.push("/app/onboarding")), [router]);
  if (!s) return null;
  const { email, voice, notifyEmail, ...draft } = s.profile;
  return (
    <>
      <ProfileClient email={email} age={ageFromBirthday(draft.birthday)} draft={draft} photos={s.photos} apps={s.apps} voice={voice} notifyEmail={notifyEmail} api={api} />
      <PreviewTools />
    </>
  );
}
