"use client";

import { useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, MoveUpRight } from "lucide-react";

const scenes = [
  {
    number: "01", label: "The brief", title: "Tell us what matters.",
    body: "Share your pace, preferences, and what you hope to find. The concierge experience starts with a real conversation, not a profile to perfect.",
    eyebrow: "A more thoughtful starting point", cardTitle: "Your point of view", note: "Intentions · Compatibility · Availability",
    detail: "More context. Less performance."
  },
  {
    number: "02", label: "The introduction", title: "An introduction with intention.",
    body: "For invited members, the concierge is designed to suggest compatible introductions and ask permission before connecting anyone.",
    eyebrow: "Permission comes first", cardTitle: "A considered introduction", note: "Why this could be worth meeting", detail: "You decide whether to say hello."
  },
  {
    number: "03", label: "The date", title: "Then, meet in real life.",
    body: "If both people are interested, the concierge will help coordinate the details so you can focus on the conversation.",
    eyebrow: "The best part happens offline", cardTitle: "A plan, simply made", note: "A place · A time · A little anticipation", detail: "The rest is yours to discover."
  }
];

export function ConciergeDemo() {
  const [active, setActive] = useState(0);
  const scene = scenes[active];

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % scenes.length;
    else if (event.key === "ArrowLeft") next = (index + scenes.length - 1) % scenes.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = scenes.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    document.getElementById(`demo-tab-${next}`)?.focus();
  }

  return (
    <section id="experience" className="experience-section">
      <div className="experience-heading section-shell">
        <div><p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> A glimpse of the experience</p><h2>Human chemistry.<br /><em>Thoughtfully arranged.</em></h2></div>
        <p>An illustrative look at the experience for invited members. A waitlist reservation does not activate concierge service.</p>
      </div>
      <div className="experience-layout section-shell">
        <div className="experience-tabs" role="tablist" aria-label="How the concierge would work">
          {scenes.map((item, index) => (
            <button key={item.number} type="button" role="tab" id={`demo-tab-${index}`} aria-selected={active === index} aria-controls="demo-panel" tabIndex={active === index ? 0 : -1} className={`experience-tab ${active === index ? "is-active" : ""}`} onClick={() => setActive(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>
              <span>{item.number}</span><strong>{item.label}</strong><MoveUpRight size={17} strokeWidth={1.4} />
            </button>
          ))}
          <div className="experience-copy" id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${active}`}>
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}>
                <h3>{scene.title}</h3><p>{scene.body}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="demo-stage" aria-live="polite">
          <div className="demo-stage-top"><span>MORROW / PRIVATE CONCIERGE</span><span>ILLUSTRATIVE PREVIEW</span></div>
          <div className="demo-orbit demo-orbit-one" /><div className="demo-orbit demo-orbit-two" />
          <AnimatePresence mode="wait">
            <motion.div key={active} className="demo-card" initial={{ opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} exit={{ opacity: 0, y: -16, rotate: 2 }} transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}>
              <div className="demo-card-head"><span className="demo-mark">m.</span><span>0{active + 1} / 03</span></div>
              <p className="demo-card-eyebrow">{scene.eyebrow}</p>
              <h4>{scene.cardTitle}</h4>
              <div className="demo-card-rule" />
              <p className="demo-card-note">{scene.note}</p>
              <div className="demo-card-bottom"><span><Check size={15} /> {scene.detail}</span><ArrowUpRight size={18} /></div>
            </motion.div>
          </AnimatePresence>
          <div className="demo-stage-bottom"><span>A CONCEPT FOR REAL CONNECTION</span><span>EST. FOR WHAT COMES NEXT</span></div>
        </div>
      </div>
    </section>
  );
}
