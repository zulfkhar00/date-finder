"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Link2 } from "lucide-react";
import { track } from "@/lib/track";

type Status = { status: "pending" | "paid" | "refunded" | "expired"; position: number | null };

function ShareButton() {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  async function copy() {
    if (state === "copying") return;
    setState("copying");
    track("share_copy");
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setState("copied");
      setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("failed");
    }
  }
  return (
    <button type="button" className="btn btn-white" onClick={copy} disabled={state === "copying"} aria-busy={state === "copying"} aria-live="polite">
      {state === "copying" ? <><span className="spinner" aria-hidden="true" /> Copying…</> : state === "copied" ? <><Check size={18} strokeWidth={3} /> Link copied</> : <><Link2 size={18} strokeWidth={2.5} /> {state === "failed" ? "Copy failed, try again" : "Copy link for a friend"}</>}
    </button>
  );
}

export function ConfirmationClient({ sessionId }: { sessionId: string | undefined }) {
  const reduce = useReducedMotion();
  const [data, setData] = useState<Status | null>(null);
  const [message, setMessage] = useState(sessionId ? "" : "This confirmation link is incomplete.");
  const [checking, setChecking] = useState(Boolean(sessionId));

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        const response = await fetch(`/api/reservation-status?session_id=${encodeURIComponent(sessionId!)}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Status unavailable");
        if (cancelled) return;
        setData(result); setChecking(false); setMessage("");
        if (result.status === "pending" && attempts++ < 15) timer = setTimeout(check, 2000);
      } catch (error) { if (!cancelled) { setChecking(false); setMessage(error instanceof Error ? error.message : "Status unavailable"); } }
    }
    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  const position = data?.status === "paid" && typeof data.position === "number" ? data.position : null;

  if (position !== null) {
    return <div className="confirm">
      <motion.div className="ticket-card" role="status" aria-live="polite" initial={reduce ? false : { opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
        <span className="label">You’re in line</span>
        <span className="queue-num" aria-label={`Number ${position}`}><span className="hash">#</span>{position.toLocaleString("en-US")}</span>
        <h1>You’re #{position.toLocaleString("en-US")} in line.</h1>
        <p>Your $1 waitlist spot is confirmed. Numbers go out in the order payments are verified, and spots open in that order.</p>
        <div className="perf">Keep this page link private. It shows your spot.</div>
      </motion.div>
      <div className="panel">
        <p className="kicker">What happens next</p>
        <ol className="next-list">
          <li><span className="how-step">1</span><span>We open spots in small groups, in queue order.</span></li>
          <li><span className="how-step">2</span><span>When yours opens, we’ll email you with the real pricing. You decide then whether to join.</span></li>
          <li><span className="how-step">3</span><span>If you join, you send us photos and screenshots. We send back your new profile and texts.</span></li>
        </ol>
        <p className="fine" style={{ marginTop: 16 }}>A waitlist spot doesn’t guarantee an invitation date, availability in your city, or a date.</p>
        <p style={{ fontWeight: 800, marginTop: 22 }}>Know a guy whose chats keep dying?</p>
        <div className="share-row"><ShareButton /><Link href="/" className="btn btn-primary">Back to NoSwipe</Link></div>
      </div>
    </div>;
  }

  let heading = "Checking your payment…";
  let detail = "Stripe is confirming your $1. Your number is assigned only after we verify the payment, which usually takes a few seconds.";
  let tone = "waiting";
  if (!checking && data?.status === "pending") { heading = "Still confirming."; detail = "Your payment hasn’t been verified yet. Refresh this page in a minute. If you were charged, your number will appear here."; }
  if (data?.status === "refunded") { heading = "Your payment was refunded."; detail = "The $1 went back to your original payment method, and your waitlist spot is no longer active."; tone = "muted"; }
  if (data?.status === "expired") { heading = "Checkout wasn’t completed."; detail = "No payment was taken and no spot was assigned. You can try again any time."; tone = "muted"; }
  if (message) { heading = "We couldn’t load this spot."; tone = "muted"; }

  return <div className="confirm">
    <div className={`ticket-card ${tone}`} role="status" aria-live="polite">
      <span className="label">Your spot</span>
      <h1>{heading}</h1>
      <p>{message ? `${message}. Check the link from your Stripe receipt, or start a new reservation.` : detail}</p>
      {checking && <p style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><span className="spinner" aria-hidden="true" /> Verifying with Stripe</p>}
      <div className="perf">The return from Checkout alone doesn’t confirm payment.</div>
    </div>
    <div className="share-row" style={{ alignSelf: "start" }}>
      {(data?.status === "expired" || data?.status === "refunded" || message) && <Link href="/reserve" className="btn btn-primary">$1 — get on the list</Link>}
      <Link href="/" className="btn btn-white">Back to NoSwipe</Link>
    </div>
  </div>;
}
