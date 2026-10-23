"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { dateFrequencyLabels, datingPreferenceLabels, relationshipGoalLabels, type ReservationInput } from "@/lib/reservation";

type FormValue = {
  ageConfirmed: boolean; city: string; email: string;
  datingPreference: ReservationInput["datingPreference"] | null;
  relationshipGoal: ReservationInput["relationshipGoal"] | null;
  dateFrequency: ReservationInput["dateFrequency"] | null;
  termsAccepted: boolean;
};
const initial: FormValue = { ageConfirmed: false, city: "", email: "", datingPreference: null, relationshipGoal: null, dateFrequency: null, termsAccepted: false };

export function ReserveForm({ cancelled }: { cancelled: boolean }) {
  const [value, setValue] = useState<FormValue>(initial);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (step > 0) headingRef.current?.focus(); }, [step]);

  function next() {
    if (step === 0 && (!value.ageConfirmed || value.city.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))) {
      setError("Confirm you're 18 or older, then enter your city and a valid email address."); return;
    }
    if (step === 1 && (!value.datingPreference || !value.relationshipGoal)) {
      setError("Please select both dating preferences before continuing."); return;
    }
    setError(""); setStep((current) => Math.min(2, current + 1));
  }

  async function submit() {
    if (!value.dateFrequency) { setError("Please choose your preferred dating pace."); return; }
    if (!value.termsAccepted) { setError("Please confirm you understand what the $1 reservation includes."); return; }
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const result = await response.json();
      if (!response.ok || typeof result.url !== "string") throw new Error(result.error || "Checkout could not open.");
      track("checkout_created", { instant: true });
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not open. Please try again.");
      setLoading(false);
    }
  }

  const change = <K extends keyof FormValue>(key: K, nextValue: FormValue[K]) => { setValue((current) => ({ ...current, [key]: nextValue })); setError(""); };
  const transition = { initial: { opacity: 0, x: 18 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -18 }, transition: { duration: 0.28 } };

  return <div className="reserve-form">
    <div className="form-progress"><strong>0{step + 1} / 03</strong><span>{["THE BASICS", "YOUR INTENTIONS", "THE RESERVATION"][step]}</span></div>
    <div className="progress-track" aria-hidden="true"><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
    {cancelled && <p className="form-cancelled" role="status">Checkout was closed. No payment was taken; you can start a new reservation here.</p>}
    <AnimatePresence mode="wait">
      <motion.div key={step} className="form-step" {...transition}>
        {step === 0 && <>
          <h2 ref={headingRef} tabIndex={-1}>First, a little about you.</h2>
          <p>Just enough to reserve a place. If invited to the concierge, we will ask for more detail then.</p>
          <div className="field-grid"><div className="field"><label htmlFor="city">Your city</label><input id="city" name="city" autoComplete="address-level2" placeholder="e.g. New York" maxLength={120} value={value.city} onChange={(event) => change("city", event.target.value)} /></div><div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} value={value.email} onChange={(event) => change("email", event.target.value)} /></div></div>
          <label className="checkbox-line"><input type="checkbox" checked={value.ageConfirmed} onChange={(event) => change("ageConfirmed", event.target.checked)} /><span>I confirm that I am 18 or older.</span></label>
        </>}
        {step === 1 && <>
          <h2 ref={headingRef} tabIndex={-1}>What feels right to you?</h2><p>These answers help us understand early interest. They do not promise a particular introduction.</p>
          <fieldset className="fieldset"><legend>I am interested in dating</legend><div className="choice-grid">{(Object.keys(datingPreferenceLabels) as ReservationInput["datingPreference"][]).map((option) => <button className="choice" type="button" key={option} aria-pressed={value.datingPreference === option} onClick={() => change("datingPreference", option)}>{datingPreferenceLabels[option]}</button>)}</div></fieldset>
          <fieldset className="fieldset"><legend>At this point, I am looking for</legend><div className="choice-grid">{(Object.keys(relationshipGoalLabels) as ReservationInput["relationshipGoal"][]).map((option) => <button className="choice" type="button" key={option} aria-pressed={value.relationshipGoal === option} onClick={() => change("relationshipGoal", option)}>{relationshipGoalLabels[option]}</button>)}</div></fieldset>
        </>}
        {step === 2 && <>
          <h2 ref={headingRef} tabIndex={-1}>Make room for possibility.</h2><p>One final preference, then review the reservation before going to secure checkout.</p>
          <fieldset className="fieldset"><legend>Ideally, how often would you like to go on dates?</legend><div className="choice-grid">{(Object.keys(dateFrequencyLabels) as ReservationInput["dateFrequency"][]).map((option) => <button className="choice" type="button" key={option} aria-pressed={value.dateFrequency === option} onClick={() => change("dateFrequency", option)}>{dateFrequencyLabels[option]}</button>)}</div></fieldset>
          <div className="review-box"><div><span>ONE-TIME WAITLIST RESERVATION</span><strong>$1</strong></div><p>This reserves a spot on the early-access waitlist. Concierge service and its pricing are separate. There is no subscription and no guaranteed date, introduction, invitation date, or city availability.</p><p>The $1 fee is nonrefundable, except where required by law.</p></div>
          <p className="review-details">We will email you if concierge access becomes available for your city. Service pricing will be shared before you decide whether to join. Your information stays private; see our <Link href="/privacy" target="_blank">privacy note</Link> and <Link href="/terms" target="_blank">reservation terms</Link>.</p>
          <label className="checkbox-line"><input type="checkbox" checked={value.termsAccepted} onChange={(event) => change("termsAccepted", event.target.checked)} /><span>I understand this is a nonrefundable $1 waitlist fee, not payment for dates or concierge service, and I agree to the reservation terms.</span></label>
        </>}
      </motion.div>
    </AnimatePresence>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions">{step > 0 ? <button className="form-back" type="button" onClick={() => { setStep(step - 1); setError(""); }}>Back a step</button> : <span />}{step < 2 ? <Button type="button" onClick={next}>Continue <ArrowRight size={18} /></Button> : <Button type="button" disabled={loading} onClick={submit}>{loading ? "Opening checkout…" : "Continue to $1 checkout"} <ArrowUpRight size={18} /></Button>}</div>
  </div>;
}
