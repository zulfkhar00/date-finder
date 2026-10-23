"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { captureAttribution, getFunnelSessionId, trackEvent } from "@/lib/attribution-client";
import { dateFrequencyLabels, datingPreferenceLabels, relationshipGoalLabels, type ReservationInput } from "@/lib/reservation";
import { track } from "@/lib/track";
import { track as trackAnalytics } from "@/lib/analytics";

type FormValue = {
  ageConfirmed: boolean; city: string; email: string;
  datingPreference: ReservationInput["datingPreference"] | null;
  relationshipGoal: ReservationInput["relationshipGoal"] | null;
  dateFrequency: ReservationInput["dateFrequency"] | null;
  termsAccepted: boolean;
};
const initial: FormValue = { ageConfirmed: false, city: "", email: "", datingPreference: null, relationshipGoal: null, dateFrequency: null, termsAccepted: false };
const stepNames = ["The basics", "What you’re after", "Your spot"];

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className="choice" type="button" aria-pressed={pressed} onClick={onClick}><span>{children}</span><span className="tick" aria-hidden="true">{pressed && <Check size={14} strokeWidth={3.5} />}</span></button>;
}

export function ReserveForm({ cancelled }: { cancelled: boolean }) {
  const [value, setValue] = useState<FormValue>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const tracked = useRef(false);

  useEffect(() => { if (step > 0) headingRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent("reserve_start", { oncePerSession: true });
    if (cancelled) trackEvent("checkout_canceled");
  }, [cancelled]);

  function next() {
    if (step === 0 && (!value.ageConfirmed || value.city.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) {
      setError("Confirm you’re 18 or older, then enter your city and a valid email address."); return;
    }
    if (step === 1 && (!value.datingPreference || !value.relationshipGoal)) {
      setError("Pick one answer for each question to continue."); return;
    }
    setError("");
    const nextStep = Math.min(2, step + 1);
    setStep(nextStep);
    track("reserve_step", { step: nextStep + 1 });
  }

  async function submit() {
    if (loading) return;
    if (!value.dateFrequency) { setError("Pick how often you’d like to be on a date."); return; }
    if (!value.termsAccepted) { setError("Tick the box to confirm you understand what the $1 covers."); return; }
    setLoading(true); setError("");
    track("checkout_submit");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...value, attribution: captureAttribution(), funnelSessionId: getFunnelSessionId() }) });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "Checkout could not open.");
      trackAnalytics("checkout_created", { instant: true });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not open. Please try again.");
      setLoading(false);
    }
  }

  const change = <K extends keyof FormValue>(key: K, nextValue: FormValue[K]) => { setValue((current) => ({ ...current, [key]: nextValue })); setError(""); };
  const transition = { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.24 } };

  return <div className="panel reserve-form">
    <div className="progress" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} data-on={i <= step} />)}</div>
    <div className="progress-label"><span>Step {step + 1} of 3</span><span>{stepNames[step]}</span></div>
    {cancelled && <p className="form-cancelled" role="status">Checkout was closed and no payment was taken. You can start again here.</p>}
    <AnimatePresence mode="wait">
      <motion.div key={step} className="form-step" {...transition}>
        {step === 0 && <>
          <h2 ref={headingRef} tabIndex={-1}>First, the basics.</h2>
          <p>Just enough to hold your spot. We’ll ask for photos and screenshots when your spot opens, not now.</p>
          <div className="field-grid">
            <div className="field"><label htmlFor="city">Your city</label><input id="city" name="city" autoComplete="address-level2" placeholder="e.g. Austin" maxLength={120} value={value.city} onChange={(event) => change("city", event.target.value)} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={value.email} onChange={(event) => change("email", event.target.value)} /></div>
          </div>
          <label className="checkbox-line"><input type="checkbox" checked={value.ageConfirmed} onChange={(event) => change("ageConfirmed", event.target.checked)} /><span>I’m 18 or older.</span></label>
        </>}
        {step === 1 && <>
          <h2 ref={headingRef} tabIndex={-1}>What are you after?</h2>
          <p>Helps us plan who to start with. No wrong answers, and it doesn’t lock you into anything.</p>
          <fieldset className="fieldset"><legend>I’m into</legend><div className="choice-grid">{(Object.keys(datingPreferenceLabels) as ReservationInput["datingPreference"][]).map((option) => <Choice key={option} pressed={value.datingPreference === option} onClick={() => change("datingPreference", option)}>{datingPreferenceLabels[option]}</Choice>)}</div></fieldset>
          <fieldset className="fieldset"><legend>Right now I’m looking for</legend><div className="choice-grid">{(Object.keys(relationshipGoalLabels) as ReservationInput["relationshipGoal"][]).map((option) => <Choice key={option} pressed={value.relationshipGoal === option} onClick={() => change("relationshipGoal", option)}>{relationshipGoalLabels[option]}</Choice>)}</div></fieldset>
        </>}
        {step === 2 && <>
          <h2 ref={headingRef} tabIndex={-1}>Last one. Then you’re in line.</h2>
          <p>Check what the $1 covers, then pay on Stripe’s secure checkout.</p>
          <fieldset className="fieldset"><legend>How often do you want to be on a date?</legend><div className="choice-grid">{(Object.keys(dateFrequencyLabels) as ReservationInput["dateFrequency"][]).map((option) => <Choice key={option} pressed={value.dateFrequency === option} onClick={() => change("dateFrequency", option)}>{dateFrequencyLabels[option]}</Choice>)}</div></fieldset>
          <div className="review-box">
            <div><span>One-time waitlist fee</span><strong>$1</strong></div>
            <p>This holds your place on the NoSwipe early-access waitlist. It isn’t a subscription, and it isn’t payment for dates, matches or concierge service; those are separate, with pricing we’ll show you before you join. No guaranteed date, introduction, invitation date or availability in your city.</p>
            <p>The $1 fee is nonrefundable, except where required by law.</p>
          </div>
          <p className="review-details">We’ll email you when your spot opens. Your answers stay private; see the <Link href="/privacy" target="_blank">privacy note</Link> and <Link href="/terms" target="_blank">reservation terms</Link>.</p>
          <label className="checkbox-line"><input type="checkbox" checked={value.termsAccepted} onChange={(event) => change("termsAccepted", event.target.checked)} /><span>I understand this is a nonrefundable $1 waitlist fee, not payment for dates or concierge service, and I agree to the reservation terms.</span></label>
        </>}
      </motion.div>
    </AnimatePresence>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      {step > 0 ? <button className="form-back" type="button" disabled={loading} onClick={() => { setStep(step - 1); setError(""); }}>Back</button> : <span />}
      {step < 2
        ? <button className="btn btn-primary" type="button" onClick={next}>Continue <ArrowRight size={18} strokeWidth={2.5} /></button>
        : <button className="btn btn-primary" type="button" disabled={loading} aria-busy={loading} onClick={submit}>{loading ? <><span className="spinner" aria-hidden="true" /> Opening checkout…</> : <><Lock size={17} strokeWidth={2.5} /> Pay $1 — get on the list</>}</button>}
    </div>
  </div>;
}
