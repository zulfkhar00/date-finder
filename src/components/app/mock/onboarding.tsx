"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { PhotoManager } from "@/components/app/photo-manager";
import { StepFields } from "@/components/app/step-fields";
import { NextSteps } from "@/components/app/views";
import { addSamplePhotos, photoApi } from "@/components/app/mock/actions";
import { payloadFor, type Draft } from "@/lib/app/draft";
import { CONSENT_STATEMENT, stepSchemas, type StepName } from "@/lib/app/domain";
import { completeOnboarding, setOnboardingStep, type MockState } from "@/lib/app/mock-core";
import { set, useMock } from "@/lib/app/mock-store";
import { leaveOnboardingTarget, stepFromState, stepState } from "@/lib/app/step-history";

type Key = "basics" | "apps" | "about" | "type" | "photos" | "consent" | "done";
const STEPS: { key: Key; title: string; sub?: string }[] = [
  { key: "basics", title: "A bit about you", sub: "We create your dating profiles and run them for you. To start, we only need your birthday (18+). The rest is optional." },
  { key: "apps", title: "Which apps?", sub: "Optional. We create your profile on each one you pick and run it for you. You just show up." },
  { key: "about", title: "What do you do?", sub: "Optional. Your profile bio comes from this." },
  { key: "type", title: "What's your type?", sub: "Optional. Who you want to meet, and what's a no." },
  { key: "photos", title: "Add your photos", sub: "Optional. Profiles do better with a few real photos of you, best one first. You can also add them later in Profile." },
  { key: "consent", title: "One last thing", sub: "Please read this before we start." },
  { key: "done", title: "You're all set" }
];
const draftOf = (s: MockState): Draft => {
  const { email: _e, voice: _v, notifyEmail: _n, ...d } = s.profile;
  void _e; void _v; void _n;
  return d;
};
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Flow({ initial }: { initial: MockState }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initial.onboarding.step, 0), STEPS.length - 1));
  const [d, setD] = useState<Draft>(() => draftOf(initial));
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState(initial.photos.length);
  const [photoKey, setPhotoKey] = useState(0);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const depth = useRef(0);
  const stepNow = useRef(step);
  useEffect(() => { stepNow.current = step; });
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    if (stepFromState(window.history.state) !== step) window.history.replaceState({ ...(window.history.state ?? {}), ...stepState(step) }, "");
  }, [step]);
  // Phone back gesture / browser back moves between the questions, like the real onboarding.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const target = stepFromState(e.state);
      if (target === null || target === stepNow.current) return;
      depth.current += target > stepNow.current ? 1 : -1;
      setStep(target); setError("");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const def = STEPS[step];
  const patch = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); setError(""); };
  function goTo(n: number) {
    window.history.pushState(stepState(n), "");
    depth.current += 1;
    setStep(n);
  }
  function back() {
    setError("");
    if (depth.current > 0) { window.history.back(); return; }
    if (step > 0) { setStep((s) => s - 1); return; }
    if (leaveOnboardingTarget({ historyLength: window.history.length, referrer: document.referrer, origin: window.location.origin }) === "back") window.history.back();
    else router.push(initial.onboarding.done ? "/app" : "/");
  }

  async function next() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const checks: StepName[] = def.key === "basics" ? ["name", "birthday", "who"] : def.key === "about" ? ["about"] : def.key === "type" ? ["type"] : def.key === "apps" ? ["apps"] : [];
      for (const k of checks) {
        const parsed = stepSchemas[k].safeParse(payloadFor(k, d));
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your answers."); return; }
      }
      await delay(300);
      if (def.key === "done") {
        set((s) => completeOnboarding(setOnboardingStep(s, 0, d)));
        router.replace("/app");
        return;
      }
      const to = Math.min(step + 1, STEPS.length - 1);
      set((s) => setOnboardingStep(s, to, d));
      goTo(to);
    } finally {
      setBusy(false);
    }
  }

  const canContinue = def.key === "consent" ? agreed : def.key === "photos" ? !photoBusy : true;
  const isBlank =
    def.key === "basics" ? d.firstName.trim() === "" && d.birthday === "" && !d.gender && d.interestedIn.length === 0 :
    def.key === "photos" ? photoCount === 0 :
    def.key === "about" ? !d.job.trim() && !d.heightCm && d.interests.every((x) => !x.trim()) :
    def.key === "type" ? !d.city.trim() && !d.ageMin && !d.ageMax && !d.lookingFor && d.dealbreakers.every((x) => !x.trim()) :
    def.key === "apps" ? d.apps.length === 0 : false;
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="ob">
      <div className="ob-top">
        <button type="button" className="ob-back" onClick={back} disabled={busy || photoBusy} aria-label="Back"><ArrowLeft size={24} /></button>
        <div className="ob-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}`}><span style={{ width: `${progress}%` }} /></div>
      </div>
      <form className="ob-body" onSubmit={(e) => { e.preventDefault(); if (canContinue) void next(); }}>
        <h1 ref={heading} tabIndex={-1} style={{ outline: "none" }}>{def.title}</h1>
        {def.sub ? <p className="app-sub">{def.sub}</p> : null}
        <div style={{ marginTop: 22 }}>
          {def.key === "photos" ? (
            <>
              <PhotoManager key={photoKey} initial={initial.photos.length && photoKey === 0 ? initial.photos : currentPhotos()} onChange={(p) => setPhotoCount(p.length)} onBusyChange={setPhotoBusy} api={photoApi} />
              <button type="button" className="app-link" style={{ marginTop: 10 }} disabled={photoBusy} onClick={() => { addSamplePhotos(); setPhotoKey((k) => k + 1); setPhotoCount(3); }}>Use three sample photos</button>
            </>
          ) : def.key === "consent" ? (
            <>
              <div className="ob-consent"><ShieldCheck size={26} aria-hidden style={{ marginBottom: 8 }} /><p>{CONSENT_STATEMENT}</p></div>
              <label className="ob-check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>I understand and agree. I&rsquo;m 18 or older, and any photos I add are of me.</span></label>
              <p className="app-fine">Preview only: nothing you enter here is saved anywhere but this browser.</p>
            </>
          ) : def.key === "done" ? (
            <NextSteps apps={d.apps.map((app) => ({ app, status: "setting_up" as const, user_paused: false }))} gaps={[]} compact />
          ) : def.key === "basics" ? (
            <div style={{ display: "grid", gap: 22 }}>
              <StepFields step="name" d={d} set={patch} compact />
              <StepFields step="birthday" d={d} set={patch} compact />
              <StepFields step="who" d={d} set={patch} />
            </div>
          ) : <StepFields step={def.key} d={d} set={patch} />}
        </div>
        <div className="ob-foot" style={{ marginTop: 26 }}>
          {error ? <p className="app-error" role="alert">{error}</p> : null}
          <button type="submit" className="app-btn" disabled={busy || !canContinue} aria-busy={busy}>
            {busy ? <><span className="app-spinner" aria-hidden /> Saving…</> : def.key === "done" ? "Take me to my home" : def.key === "consent" ? "Create my profiles" : isBlank ? "Skip for now" : "Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}

function currentPhotos() {
  // Read at the moment the photo step re-mounts (after sample photos were added), straight from the store.
  let photos: MockState["photos"] = [];
  set((s) => { photos = s.photos; return s; });
  return photos;
}

export function MockOnboarding() {
  const s = useMock();
  if (!s) return <div className="ob"><div className="app-empty" role="status" aria-label="Loading"><span className="app-spinner" aria-hidden /></div></div>;
  return <Flow initial={s} />;
}
