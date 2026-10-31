"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Lock } from "lucide-react";
import { captureAttribution, getFunnelSessionId, trackEvent } from "@/lib/attribution-client";
import { DATING_APPS, datingAppLabels, dateFrequencyLabels, datingPreferenceLabels, relationshipGoalLabels, type DatingApp, type ReservationInput } from "@/lib/reservation";
import { track } from "@/lib/track";
import { track as trackAnalytics } from "@/lib/analytics";
import { EmbeddedPayment } from "@/components/embedded-payment";
import { readCheckoutResponse, type EmbeddedPayment as Payment } from "@/lib/checkout-presentation";

type FormValue = {
  name: string; age: string; city: string; email: string;
  datingPreference: ReservationInput["datingPreference"] | null;
  ageMin: string; ageMax: string; interests: string;
  relationshipGoal: ReservationInput["relationshipGoal"] | null;
  apps: DatingApp[];
  dateFrequency: ReservationInput["dateFrequency"] | null;
  termsAccepted: boolean;
};
const initial: FormValue = { name: "", age: "", city: "", email: "", datingPreference: null, ageMin: "", ageMax: "", interests: "", relationshipGoal: null, apps: [], dateFrequency: null, termsAccepted: false };
const stepNames = ["About you", "Who you’re looking for", "Your apps"];
const LAST = stepNames.length - 1;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const toAge = (value: string) => (/^\d{2}$/.test(value.trim()) ? Number(value.trim()) : NaN);
const validAge = (age: number) => Number.isInteger(age) && age >= 18 && age <= 99;

function Choice({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button className="choice" type="button" aria-pressed={pressed} onClick={onClick}><span>{children}</span><span className="tick" aria-hidden="true">{pressed && <Check size={14} strokeWidth={3.5} />}</span></button>;
}

export function ReserveForm({ cancelled }: { cancelled: boolean }) {
  const [value, setValue] = useState<FormValue>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const tracked = useRef(false);

  useEffect(() => { if (step > 0) headingRef.current?.focus(); }, [step]);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent("reserve_start", { oncePerSession: true });
    track("onboarding_started");
    if (cancelled) trackEvent("checkout_canceled");
  }, [cancelled]);

  function check(current: number): string {
    if (current === 0) {
      if (!value.name.trim()) return "Tell us your first name.";
      const age = toAge(value.age);
      if (!validAge(age)) return "Enter your age. You need to be 18 or older.";
      if (value.city.trim().length < 2) return "Enter your city.";
      if (!EMAIL.test(value.email.trim())) return "Enter a valid email address.";
    }
    if (current === 1) {
      if (!value.datingPreference) return "Pick who you’d like to date.";
      const min = toAge(value.ageMin), max = toAge(value.ageMax);
      if (!validAge(min) || !validAge(max) || min > max) return "Enter an age range between 18 and 99, youngest first.";
      if (!value.relationshipGoal) return "Pick what you’re looking for right now.";
    }
    if (current === 2) {
      if (value.apps.length === 0) return "Pick at least one app.";
      if (!value.dateFrequency) return "Pick how often you’d like to be on a date.";
    }
    return "";
  }

  function next() {
    const problem = check(step);
    if (problem) { setError(problem); return; }
    setError("");
    const nextStep = Math.min(LAST, step + 1);
    setStep(nextStep);
    track("reserve_step", { step: nextStep + 1 });
  }

  async function submit() {
    if (submitting.current) return;
    for (let i = 0; i <= LAST; i++) { const problem = check(i); if (problem) { setStep(i); setError(problem); return; } }
    if (!value.termsAccepted) { setError("Tick the box to agree to the terms."); return; }
    submitting.current = true;
    setLoading(true); setError("");
    track("onboarding_completed");
    track("checkout_submit");
    const body = {
      checkoutMode: "embedded",
      ageConfirmed: true,
      city: value.city.trim(),
      email: value.email.trim(),
      datingPreference: value.datingPreference,
      relationshipGoal: value.relationshipGoal,
      dateFrequency: value.dateFrequency,
      termsAccepted: true,
      onboarding: {
        name: value.name.trim(), age: toAge(value.age), apps: value.apps,
        ageMin: toAge(value.ageMin), ageMax: toAge(value.ageMax), interests: value.interests.trim()
      },
      attribution: captureAttribution(),
      funnelSessionId: getFunnelSessionId()
    };
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Checkout could not open.");
      const checkout = readCheckoutResponse(result);
      trackAnalytics("checkout_created", { instant: true });
      if (checkout.mode === "embedded") {
        setPayment(checkout);
        setLoading(false);
        submitting.current = false;
      } else window.location.assign(checkout.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not open. Please try again.");
      setLoading(false);
      submitting.current = false;
    }
  }

  const change = <K extends keyof FormValue>(key: K, nextValue: FormValue[K]) => { setValue((current) => ({ ...current, [key]: nextValue })); setError(""); };
  const toggleApp = (app: DatingApp) => change("apps", value.apps.includes(app) ? value.apps.filter((item) => item !== app) : [...value.apps, app]);
  const transition = { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.24 } };

  if (payment) return <div className="panel reserve-form"><EmbeddedPayment payment={payment} onBack={() => setPayment(null)} /></div>;

  return <div className="panel reserve-form">
    <div className="progress" aria-hidden="true">{stepNames.map((_, i) => <span key={i} data-on={i <= step} />)}</div>
    <div className="progress-label"><span>Step {step + 1} of {stepNames.length}</span><span>{stepNames[step]}</span></div>
    {cancelled && <p className="form-cancelled" role="status">Checkout was closed and no payment was taken. You can start again here.</p>}
    <AnimatePresence mode="wait">
      <motion.div key={step} className="form-step" {...transition}>
        {step === 0 && <>
          <h2 ref={headingRef} tabIndex={-1}>First, about you.</h2>
          <p>Three short steps, about a minute. Your answers stay private.</p>
          <div className="field-grid">
            <div className="field"><label htmlFor="name">First name</label><input id="name" name="given-name" autoComplete="given-name" placeholder="e.g. Alex" maxLength={60} value={value.name} onChange={(event) => change("name", event.target.value)} /></div>
            <div className="field"><label htmlFor="age">Your age</label><input id="age" name="age" inputMode="numeric" placeholder="18+" maxLength={2} value={value.age} onChange={(event) => change("age", event.target.value.replace(/\D/g, ""))} /></div>
            <div className="field"><label htmlFor="city">Your city</label><input id="city" name="city" autoComplete="address-level2" placeholder="e.g. Austin" maxLength={120} value={value.city} onChange={(event) => change("city", event.target.value)} /></div>
            <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={value.email} onChange={(event) => change("email", event.target.value)} /></div>
          </div>
        </>}
        {step === 1 && <>
          <h2 ref={headingRef} tabIndex={-1}>Who are you looking for?</h2>
          <p>We use this to tailor profile suggestions, message drafts and date ideas to your preferences.</p>
          <fieldset className="fieldset"><legend>I want to date</legend><div className="choice-grid">{(Object.keys(datingPreferenceLabels) as ReservationInput["datingPreference"][]).map((option) => <Choice key={option} pressed={value.datingPreference === option} onClick={() => change("datingPreference", option)}>{datingPreferenceLabels[option]}</Choice>)}</div></fieldset>
          <fieldset className="fieldset"><legend>Age range</legend><div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="field"><label htmlFor="age-min">From</label><input id="age-min" inputMode="numeric" placeholder="e.g. 24" maxLength={2} value={value.ageMin} onChange={(event) => change("ageMin", event.target.value.replace(/\D/g, ""))} /></div>
            <div className="field"><label htmlFor="age-max">To</label><input id="age-max" inputMode="numeric" placeholder="e.g. 32" maxLength={2} value={value.ageMax} onChange={(event) => change("ageMax", event.target.value.replace(/\D/g, ""))} /></div>
          </div></fieldset>
          <div className="field" style={{ marginBottom: 22 }}><label htmlFor="interests">What’s your type? <span className="field-optional">(optional)</span></label><input id="interests" placeholder="e.g. outdoorsy, into music, likes to travel" maxLength={300} value={value.interests} onChange={(event) => change("interests", event.target.value)} /></div>
          <fieldset className="fieldset"><legend>Right now I’m looking for</legend><div className="choice-grid">{(Object.keys(relationshipGoalLabels) as ReservationInput["relationshipGoal"][]).map((option) => <Choice key={option} pressed={value.relationshipGoal === option} onClick={() => change("relationshipGoal", option)}>{relationshipGoalLabels[option]}</Choice>)}</div></fieldset>
        </>}
        {step === 2 && <>
          <h2 ref={headingRef} tabIndex={-1}>Which apps?</h2>
          <p>Pick every app where you want profile or message help.</p>
          <fieldset className="fieldset"><legend>Apps</legend><div className="choice-grid">{DATING_APPS.map((app) => <Choice key={app} pressed={value.apps.includes(app)} onClick={() => toggleApp(app)}>{datingAppLabels[app]}</Choice>)}</div></fieldset>
          <fieldset className="fieldset"><legend>How often do you want to be on a date?</legend><div className="choice-grid">{(Object.keys(dateFrequencyLabels) as ReservationInput["dateFrequency"][]).map((option) => <Choice key={option} pressed={value.dateFrequency === option} onClick={() => change("dateFrequency", option)}>{dateFrequencyLabels[option]}</Choice>)}</div></fieldset>
          <div className="review-box"><div><span>Photos</span><strong>Later</strong></div><p>Skip this for now. If concierge access opens, you can share real photos or screenshots for ranking and draft suggestions. We never create fake photos.</p></div>
          <p className="review-details">NoSwipe never gets access to your dating apps. You see the exact price and what it covers on the next screen, before you pay anything. Your answers stay private; see the <Link href="/privacy" target="_blank">privacy note</Link> and <Link href="/terms" target="_blank">terms</Link>.</p>
          <label className="checkbox-line"><input type="checkbox" checked={value.termsAccepted} onChange={(event) => change("termsAccepted", event.target.checked)} /><span>I agree to the terms and the privacy note.</span></label>
        </>}
      </motion.div>
    </AnimatePresence>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">
      {step > 0 ? <button className="form-back" type="button" disabled={loading} onClick={() => { setStep(step - 1); setError(""); }}>Back</button> : <span />}
      {step < LAST
        ? <button className="btn btn-primary" type="button" onClick={next}>Continue <ArrowRight size={18} strokeWidth={2.5} /></button>
        : <button className="btn btn-primary" type="button" disabled={loading} aria-busy={loading} onClick={submit}>{loading ? <><span className="spinner" aria-hidden="true" /> Opening checkout…</> : <><Lock size={17} strokeWidth={2.5} /> Continue to checkout</>}</button>}
    </div>
  </div>;
}
