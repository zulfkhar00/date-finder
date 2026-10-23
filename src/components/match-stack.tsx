"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarCheck, Check } from "lucide-react";

const stages = ["Match", "Chat", "Date"] as const;
type Stage = (typeof stages)[number];

const card = { initial: { opacity: 0, y: 40, rotate: -4, scale: 0.94 }, animate: { opacity: 1, y: 0, rotate: 0, scale: 1 }, exit: { opacity: 0, x: 120, rotate: 10 }, transition: { type: "spring" as const, stiffness: 260, damping: 24 } };

export function MatchStack() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return;
    const timer = setTimeout(() => setIndex((current) => (current + 1) % stages.length), 2800);
    return () => clearTimeout(timer);
  }, [index, reduce, paused]);

  const stage: Stage = stages[index];

  return (
    <section className="section" aria-labelledby="stack-title">
      <div className="shell stack-grid">
        <div>
          <p className="kicker">Where this goes · Example</p>
          <h2 id="stack-title" className="h2">Match. Chat. <span className="mark">Thursday, 8pm.</span></h2>
          <p className="lede">The point isn’t more matches to stare at. It’s getting from “it’s a match” to an actual plan, without the chat dying on the way.</p>
          <ul className="outcome-list">
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> A profile that gets the right swipes</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> Openers and replies that keep it going</li>
            <li><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span> A nudge when it’s time to ask her out</li>
          </ul>
        </div>

        <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div className="stack-stage" aria-live="polite">
            <div className="stack-ghost g1" aria-hidden="true" />
            <div className="stack-ghost g2" aria-hidden="true" />
            <AnimatePresence mode="wait">
              {stage === "Match" && (
                <motion.div key="match" className="stack-card" {...card}>
                  <span className="example-tag">Example</span>
                  <p className="match-title" style={{ marginTop: 14 }}>It’s a match!</p>
                  <div className="match-pair" aria-hidden="true"><span className="avatar av-4">You</span><span className="avatar av-3">R</span></div>
                  <p className="caption">You and Rae liked each other</p>
                </motion.div>
              )}
              {stage === "Chat" && (
                <motion.div key="chat" className="stack-card" {...card}>
                  <span className="example-tag">Example</span>
                  <div className="chat-body" style={{ padding: "16px 0 0" }}>
                    <div className="bubble bubble-him bubble-sent">Your hiking photo is either a great view or a very convincing green screen. Which trail?</div>
                    <div className="bubble bubble-her">haha it’s real! Mission Peak. you hike?</div>
                    <div className="bubble bubble-him bubble-sent">Badly, but with snacks. Drinks Thursday and you can judge my trail picks?</div>
                  </div>
                </motion.div>
              )}
              {stage === "Date" && (
                <motion.div key="date" className="stack-card ticket" {...card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="example-tag">Example</span>
                    <CalendarCheck size={26} strokeWidth={2.2} aria-hidden="true" />
                  </div>
                  <p className="big" style={{ marginTop: 16 }}>Thursday</p>
                  <p className="big">8:00 PM</p>
                  <p style={{ fontWeight: 700, marginTop: 8 }}>Drinks with Rae · her pick of bar</p>
                  <div className="ticket-row"><span>Date confirmed</span><span className="check-dot"><Check size={14} strokeWidth={3.5} /></span></div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="steps-dots" role="group" aria-label="Show stage">
            {stages.map((name, i) => <button key={name} type="button" aria-pressed={i === index} onClick={() => { setIndex(i); setPaused(true); }}>{name}</button>)}
          </div>
        </div>
      </div>
    </section>
  );
}
