"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { PhotoManager } from "@/components/app/photo-manager";
import { StepFields } from "@/components/app/step-fields";
import { payloadFor, type Draft } from "@/lib/app/draft";
import { advanceStep, giveConsent, saveStep } from "@/lib/app/actions";
import { CONSENT_STATEMENT, type StepName } from "@/lib/app/domain";
import type { Photo } from "@/lib/app/data";
import { captureAttribution, getFunnelSessionId, trackEvent } from "@/lib/attribution-client";
import { readCheckoutResponse, type EmbeddedPayment as Payment } from "@/lib/checkout-presentation";

// Stripe.js only loads when the payment step opens.
const EmbeddedPayment = dynamic(() => import("@/components/embedded-payment").then((m) => m.EmbeddedPayment), { ssr: false });

type StepDef = { key: StepName | "photos" | "consent" | "pay"; title: string; sub?: string };
const STEPS: StepDef[] = [
  { key: "name", title: "What's your first name?", sub: "Optional. This is how you'll show up on your profiles." },
  { key: "birthday", title: "When's your birthday?", sub: "Optional. If you add it, you must be 18 or older. Only your age is shown." },
  { key: "who", title: "A bit about you", sub: "Optional. So we show you to the right people." },
  { key: "photos", title: "Add your photos", sub: "Optional, but profiles do better with 3 to 6 real photos of you. Best one first." },
  { key: "about", title: "What do you do?", sub: "Optional. Your profile bio comes from this." },
  { key: "type", title: "What's your type?", sub: "Optional. Who you want to meet, and what's a no." },
  { key: "apps", title: "Which apps?", sub: "Optional. We create and run your profile on each one you pick." },
  { key: "consent", title: "One last thing", sub: "Please read this before we start." },
  { key: "pay", title: "Reserve early access" }
];
const LAST_FORM = 7;

const toAge = (iso: string) => { if (!iso) return 30; const y = Number(iso.slice(0, 4)); return Number.isFinite(y) ? new Date().getFullYear() - y : 30; };

export function OnboardingFlow({ email, draft: initial, photos: initialPhotos, startStep, paid }: { email: string; draft: Draft; photos: Photo[]; startStep: number; paid: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(startStep);
  const [d, setD] = useState(initial);
  const [photoCount, setPhotoCount] = useState(initialPhotos.length);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent("reserve_start", { oncePerSession: true });
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);

  const def = STEPS[step];
  const set = (patch: Partial<Draft>) => { setD((x) => ({ ...x, ...patch })); setError(""); };
  const progress = Math.round(((step + 1) / STEPS.length) * 100);

  async function next() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (def.key === "photos") {
        const r = await advanceStep(step + 1);
        if (!r.ok) { setError(r.error); return; }
      } else if (def.key === "consent") {
        const r = await giveConsent(agreed);
        if (!r.ok) { setError(r.error); return; }
        trackEvent("onboarding_complete", { oncePerSession: true });
        if (paid) { router.replace("/home"); return; }
      } else if (def.key !== "pay") {
        const r = await saveStep(def.key, payloadFor(def.key, d), step + 1);
        if (!r.ok) { setError(r.error); return; }
      }
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } finally {
      setBusy(false);
    }
  }

  async function openCheckout() {
    if (busy) return;
    setBusy(true); setError("");
    const pref = d.interestedIn.length === 1 && d.interestedIn[0] !== "nonbinary" ? d.interestedIn[0] : "all_genders";
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkoutMode: "embedded", ageConfirmed: true, termsAccepted: true, email, city: d.city.trim(),
          datingPreference: pref, relationshipGoal: d.lookingFor || "meaningful", dateFrequency: "twice_monthly",
          onboarding: { name: d.firstName.trim(), age: Math.min(99, Math.max(18, toAge(d.birthday))), apps: d.apps, ageMin: Number(d.ageMin) || 18, ageMax: Number(d.ageMax) || 99, interests: d.interests.filter(Boolean).join(", ").slice(0, 300) },
          attribution: captureAttribution(), funnelSessionId: getFunnelSessionId()
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Checkout could not open.");
      const checkout = readCheckoutResponse(result);
      if (checkout.mode === "embedded") setPayment(checkout); else window.location.assign(checkout.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not open. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const canBack = step > 0 && step <= LAST_FORM && !busy;
  // Only the consent box is required. Every other step can be skipped.
  const canContinue = def.key === "consent" ? agreed : true;
  const isBlank =
    def.key === "name" ? d.firstName.trim() === "" :
    def.key === "birthday" ? d.birthday === "" :
    def.key === "who" ? !d.gender && d.interestedIn.length === 0 :
    def.key === "photos" ? photoCount === 0 :
    def.key === "about" ? !d.job.trim() && !d.heightCm && d.interests.every((x) => !x.trim()) :
    def.key === "type" ? !d.city.trim() && !d.ageMin && !d.ageMax && !d.lookingFor && d.dealbreakers.every((x) => !x.trim()) :
    def.key === "apps" ? d.apps.length === 0 : false;
  // Early access (the $1 step, unchanged) still needs these to open checkout.
  const checkoutReady = d.firstName.trim() !== "" && d.city.trim().length >= 2 && d.birthday !== "" && d.apps.length > 0;

  if (payment) return (
    <div className="ob"><div className="ob-body"><div className="panel reserve-form"><EmbeddedPayment payment={payment} onBack={() => setPayment(null)} completeHref="/home" /></div></div></div>
  );

  return (
    <div className="ob">
      <div className="ob-top">
        <button type="button" className="ob-back" onClick={() => { setStep((s) => s - 1); setError(""); }} disabled={!canBack} aria-label="Back"><ArrowLeft size={24} /></button>
        <div className="ob-bar" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${STEPS.length}`}><span style={{ width: `${progress}%` }} /></div>
      </div>
      <form className="ob-body" onSubmit={(e) => { e.preventDefault(); if (def.key === "pay") void openCheckout(); else if (canContinue) void next(); }}>
        <h1 ref={heading} tabIndex={-1} style={{ outline: "none" }}>{def.title}</h1>
        {def.sub ? <p className="app-sub">{def.sub}</p> : null}
        <div style={{ marginTop: 22 }}>
          {def.key === "photos" ? <PhotoManager initial={initialPhotos} onChange={(p) => setPhotoCount(p.length)} /> :
           def.key === "consent" ? (
            <>
              <div className="ob-consent"><ShieldCheck size={26} aria-hidden style={{ marginBottom: 8 }} /><p>{CONSENT_STATEMENT}</p></div>
              <label className="ob-check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>I understand and agree. I&rsquo;m 18 or older, and any photos I add are of me.</span></label>
              <p className="app-fine">See the <a href="/terms" target="_blank" rel="noreferrer">terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">privacy note</a>. You can delete everything from your profile any time.</p>
            </>
           ) : def.key === "pay" ? (
            <>
              <div className="app-card"><Lock size={22} aria-hidden /><p style={{ marginTop: 8, fontWeight: 700 }}>Your profile is saved.</p><p className="app-sub">Early access is a one-time, refundable $1.00 payment. You see the exact price and what it covers on the next screen, before you pay anything.</p>{checkoutReady ? null : <p className="app-fine" style={{ marginTop: 8 }}>Early access needs your name, birthday, city and at least one app. Add them in Profile, or skip it.</p>}</div>
            </>
           ) : <StepFields step={def.key} d={d} set={set} />}
        </div>
        {error ? <p className="app-error" role="alert" style={{ marginTop: 14 }}>{error}</p> : null}
        <div className="ob-foot" style={{ marginTop: 26 }}>
          {def.key === "pay" ? (
            <>
              <button type="submit" className="app-btn" disabled={busy || !checkoutReady} aria-busy={busy}>{busy ? <><span className="app-spinner" aria-hidden /> Opening checkout…</> : <><Lock size={18} aria-hidden /> Continue to checkout</>}</button>
              <button type="button" className="app-link" onClick={() => router.replace("/home")} disabled={busy}>Not now, take me to my home</button>
            </>
          ) : (
            <button type="submit" className="app-btn" disabled={busy || !canContinue} aria-busy={busy}>
              {busy ? <><span className="app-spinner" aria-hidden /> Saving…</> : def.key === "consent" ? "Create my profiles" : isBlank ? "Skip for now" : "Continue"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
