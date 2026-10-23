"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, Wand2 } from "lucide-react";
import { track } from "@/lib/track";

type Line = { from: "her" | "him"; text: string };
type Scenario = { id: string; title: string; sub: string; name: string; initial: string; avatar: string; app: string; chat: Line[]; meta: string; fix: string; why: string };

// Pre-written examples. No API calls, nothing the visitor types is sent anywhere.
const scenarios: Scenario[] = [
  {
    id: "hey", title: "She left me on “hey”", sub: "Seen 3 days ago. Nothing.", name: "Sophie", initial: "S", avatar: "av-3", app: "Tinder",
    chat: [{ from: "him", text: "hey" }], meta: "Seen Tuesday",
    fix: "Ok, “hey” was lazy. Your bio says you’re looking for someone to split fries with. Real question: shared plate, or do I order my own?",
    why: "“hey” gives her nothing to answer. This owns the weak opener and turns her own profile into an easy, fun question."
  },
  {
    id: "died", title: "Chat died after 3 messages", sub: "Small talk, then silence.", name: "Jess", initial: "J", avatar: "av-2", app: "Hinge",
    chat: [{ from: "her", text: "haha yeah work’s been insane" }, { from: "him", text: "same lol" }, { from: "her", text: "lol" }], meta: "4 days ago",
    fix: "Ok, we’re both clearly overworked. Tacos Thursday? I know a spot that’s worth leaving the office for.",
    why: "Small talk was going nowhere. Instead of another “how’s your week”, it makes one specific, easy plan."
  },
  {
    id: "boring", title: "I answered like a robot", sub: "She asked. I said “not much.”", name: "Priya", initial: "P", avatar: "av-4", app: "Bumble",
    chat: [{ from: "her", text: "so what do you do for fun?" }, { from: "him", text: "not much tbh. gym, netflix" }], meta: "Read 2 days ago",
    fix: "Gym by day. By night I’m three seasons into a show I refuse to name until a second date. Your turn: what’s your guilty pleasure?",
    why: "Same facts, but now there’s something to tease you about and a question that hands the conversation back to her."
  },
  {
    id: "sometime", title: "“We should hang out sometime”", sub: "…and nobody made a plan.", name: "Dani", initial: "D", avatar: "av-1", app: "Hinge",
    chat: [{ from: "her", text: "we should hang out sometime!" }, { from: "him", text: "yeah for sure" }], meta: "1 week ago",
    fix: "Let’s make “sometime” real: Thursday 8pm, drinks at that place on 5th? If that’s bad, you pick the day.",
    why: "“Sometime” usually means never. A day, a time and a place make yes the easy answer."
  }
];

const bio = {
  before: { about: "6'1. Gym, travel, good food. Not great at these, just ask.", second: ["My simple pleasures", "Sleeping in."] },
  after: { about: "Will cook you the best carbonara of your life, then lose to you at Mario Kart. Most recent trip: Lisbon, four straight days of custard tarts.", second: ["Together, we could", "Find the best tacos in the city. I have a spreadsheet. I’m not joking."] }
};

type Phase = "idle" | "fixing" | "typing" | "done";

export function FixMyText() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<"text" | "bio">("text");
  const [pickedId, setPickedId] = useState(scenarios[0].id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [typed, setTyped] = useState("");
  const [bioView, setBioView] = useState<"before" | "after">("before");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const picked = scenarios.find((item) => item.id === pickedId) ?? scenarios[0];

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  function pick(id: string) {
    clearTimers();
    setPickedId(id); setPhase("idle"); setTyped("");
    track("demo_pick", { scenario: id });
  }

  function fix() {
    if (phase === "fixing" || phase === "typing") return;
    clearTimers();
    track("demo_fix", { scenario: picked.id });
    if (reduce) { setTyped(picked.fix); setPhase("done"); return; }
    setTyped(""); setPhase("fixing");
    timers.current.push(setTimeout(() => {
      setPhase("typing");
      const text = picked.fix;
      let i = 0;
      const tick = () => {
        i = Math.min(text.length, i + 2);
        setTyped(text.slice(0, i));
        if (i < text.length) timers.current.push(setTimeout(tick, 22));
        else setPhase("done");
      };
      tick();
    }, 900));
  }

  const busy = phase === "fixing" || phase === "typing";
  const view = bio[bioView];

  return (
    <section id="demo" className="section demo" aria-labelledby="demo-title">
      <div className="shell">
        <div className="demo-head">
          <p className="kicker">Try it · Example</p>
          <h2 id="demo-title" className="h2">Your chat died. <span className="mark">Let’s fix it.</span></h2>
          <p className="lede">Pick a dead chat you’ve definitely had. Watch what we’d send instead. These are pre-written examples. Nothing you tap here goes anywhere.</p>
          <div className="mode-switch" role="group" aria-label="Demo mode">
            <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")}>Fix my text</button>
            <button type="button" aria-pressed={mode === "bio"} onClick={() => { setMode("bio"); track("demo_bio", { view: bioView }); }}>Fix my bio</button>
          </div>
        </div>

        {mode === "text" ? (
          <div className="demo-grid">
            <div className="scenario-list" role="group" aria-label="Pick a dead chat">
              {scenarios.map((item, index) => (
                <button key={item.id} type="button" className="scenario" aria-pressed={item.id === pickedId} onClick={() => pick(item.id)}>
                  <span className="num">{index + 1}</span>
                  <span>{item.title}<small>{item.sub}</small></span>
                </button>
              ))}
            </div>

            <div className="demo-phone">
              <div className="phone">
                <div className="phone-screen">
                  <div className="phone-notch" aria-hidden="true" />
                  <div className="chat-head">
                    <span className={`avatar ${picked.avatar}`} aria-hidden="true">{picked.initial}</span>
                    <span className="who"><strong>{picked.name}</strong><span>Example chat · {picked.app}</span></span>
                    <span className="example-tag">Example</span>
                  </div>
                  <div className="chat-body" aria-live="polite">
                    {picked.chat.map((line, index) => <div key={`${picked.id}-${index}`} className={`bubble ${line.from === "her" ? "bubble-her" : "bubble-him"}`}>{line.text}</div>)}
                    <div className={`chat-meta ${picked.chat[picked.chat.length - 1].from === "her" ? "left" : ""}`}>{picked.meta}</div>
                    <AnimatePresence>
                      {phase !== "idle" && (
                        <motion.div key={`${picked.id}-suggest`} className="suggest" initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 28 }}>
                          <div className="suggest-label"><Sparkles size={14} strokeWidth={2.5} /> {phase === "fixing" ? "Reading the chat…" : "NoSwipe suggests"}</div>
                          {phase === "fixing" ? <div className="typing" style={{ background: "transparent", border: 0, padding: "4px 0" }}><i /><i /><i /></div> : <p>{typed}{phase === "typing" && <span aria-hidden="true">▍</span>}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <button type="button" className="btn btn-primary" onClick={fix} disabled={busy} aria-busy={busy}>
                {busy ? <><span className="spinner" aria-hidden="true" /> Fixing…</> : <><Wand2 size={18} strokeWidth={2.5} /> {phase === "done" ? "Replay the fix" : "Fix this chat"}</>}
              </button>
              <AnimatePresence>
                {phase === "done" && (
                  <motion.div className="why" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <strong>Why it works</strong>
                    <p>{picked.why}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="bio-wrap">
            <div className="ba-switch" role="group" aria-label="Show bio">
              <button type="button" aria-pressed={bioView === "before"} onClick={() => { setBioView("before"); track("demo_bio", { view: "before" }); }}>Before</button>
              <button type="button" aria-pressed={bioView === "after"} onClick={() => { setBioView("after"); track("demo_bio", { view: "after" }); }}>After</button>
            </div>
            <div className="profile-card">
              <div className="profile-top">
                <svg className="silhouette" viewBox="0 0 120 150" aria-hidden="true">
                  <circle cx="60" cy="48" r="30" fill="#22104A" />
                  <path d="M8 150c0-34 23-58 52-58s52 24 52 58z" fill="#22104A" />
                </svg>
                <span className="example-tag">Example profile</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={bioView} className="profile-body" initial={{ opacity: 0, rotateX: -12 }} animate={{ opacity: 1, rotateX: 0 }} exit={{ opacity: 0, rotateX: 12 }} transition={{ duration: reduce ? 0 : 0.25 }}>
                  <h3>Alex, 28</h3>
                  <div className="prompt"><span>About me</span><p>{view.about}</p></div>
                  <div className="prompt"><span>{view.second[0]}</span><p>{view.second[1]}</p></div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="why">
              <strong>{bioView === "before" ? "What’s wrong" : "Why it works"}</strong>
              <p>{bioView === "before" ? "Height, gym, travel, “just ask.” Every other profile says the same thing, and none of it gives her an opener." : "Specific beats generic. Every line is something she can reply to, so the first message writes itself."}</p>
            </div>
          </div>
        )}
        <p className="demo-note">Examples only. The real thing works from your screenshots, in your voice, and you send every message yourself.</p>
      </div>
    </section>
  );
}
