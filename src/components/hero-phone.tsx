"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, PenLine } from "lucide-react";

const OPENER = "Ok, real question: is your dog always that photogenic or was that a lucky shot?";
// How long each step stays on screen before the next one (ms). Last entry = pause before looping.
const STEP_MS = [1400, 2200, 1800, 3800];
const LAST = STEP_MS.length - 1;

const pop = { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.96 }, transition: { type: "spring" as const, stiffness: 420, damping: 30 } };

export function HeroPhone() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const timer = setTimeout(() => setStep((current) => (current >= LAST ? 0 : current + 1)), STEP_MS[step]);
    return () => clearTimeout(timer);
  }, [step, reduce]);

  const s = reduce ? LAST : step;

  return (
    <div className="phone" role="img" aria-label="An example Hinge match: NoSwipe opens the chat from her profile and books the date.">
      <div className="phone-screen" aria-hidden="true">
        <div className="phone-notch" />
        <div className="chat-head">
          <span className="avatar av-1">M</span>
          <span className="who"><strong>Example context</strong><span>New match · Hinge</span></span>
          <span className="example-tag">Example</span>
        </div>
        <div className="chat-body">
          <motion.div layout className="chat-divider">From her profile</motion.div>
          <AnimatePresence mode="popLayout">
            {s >= 1 && <motion.div layout key="context" className="bubble bubble-her" {...pop}>My dog Biscuit has never met a camera he didn’t like.</motion.div>}
            {s >= 2 && (
              <motion.div layout key="suggest" className="suggest" {...pop}>
                <div className="suggest-label"><PenLine size={14} strokeWidth={2.5} /> NoSwipe sent</div>
                <p>{OPENER}</p>
              </motion.div>
            )}
            {s >= 3 && <motion.div layout key="ready" className="date-pill" {...pop}><span className="check-dot"><Check size={14} strokeWidth={3} /></span> Date booked · Thu 8 pm</motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
