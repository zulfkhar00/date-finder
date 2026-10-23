"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, PenLine } from "lucide-react";

const OPENER = "Ok, real question: is your dog always that photogenic or was that a lucky shot?";
// How long each step stays on screen before the next one (ms). Last entry = pause before looping.
const STEP_MS = [1500, 2300, 1300, 1200, 1500, 1300, 3800];
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
    <div className="phone" role="img" aria-label="Example: NoSwipe chats with a new match for you, she replies, they set a Saturday date, and you get a text that the date is confirmed.">
      <div className="phone-screen" aria-hidden="true">
        <div className="phone-notch" />
        <div className="chat-head">
          <span className="avatar av-1">M</span>
          <span className="who"><strong>Maya</strong><span>New match on Hinge</span></span>
          <span className="example-tag">Example</span>
        </div>
        <div className="chat-body">
          <motion.div layout className="chat-divider">You matched today</motion.div>
          <AnimatePresence mode="popLayout">
            {s === 1 && (
              <motion.div layout key="suggest" className="suggest" {...pop}>
                <div className="suggest-label"><PenLine size={14} strokeWidth={2.5} /> NoSwipe is chatting for you</div>
                <p>{OPENER}</p>
              </motion.div>
            )}
            {s >= 2 && <motion.div layout key="sent" className="bubble bubble-him bubble-sent" {...pop}>{OPENER}</motion.div>}
            {s === 3 && <motion.div layout key="typing" className="typing" {...pop}><i /><i /><i /></motion.div>}
            {s >= 4 && <motion.div layout key="r1" className="bubble bubble-her" {...pop}>lol he’s a menace. but yes, always</motion.div>}
            {s >= 5 && <motion.div layout key="ask" className="bubble bubble-him bubble-sent" {...pop}>Then he’s invited. Coffee and a walk Saturday?</motion.div>}
            {s >= 6 && <motion.div layout key="r2" className="bubble bubble-her" {...pop}>ok fine. sat at 11, here’s my number</motion.div>}
            {s >= 6 && <motion.div layout key="date" className="date-pill" {...pop}><span className="check-dot"><CalendarCheck size={14} strokeWidth={3} /></span> Text to you: date confirmed, Sat 11 AM</motion.div>}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
