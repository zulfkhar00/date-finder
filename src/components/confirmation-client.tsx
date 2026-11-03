"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Check, Link2 } from "lucide-react";
import { track } from "@/lib/track";
import { trackOnce } from "@/lib/analytics";

type Status = { status: "pending" | "paid" | "refunded" | "expired" };

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
        if (result.status === "paid") trackOnce("paid", `paid:${sessionId}`);
        if (result.status === "pending" && attempts++ < 15) timer = setTimeout(check, 2000);
      } catch (error) { if (!cancelled) { setChecking(false); setMessage(error instanceof Error ? error.message : "Status unavailable"); } }
    }
    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId]);

  if (data?.status === "paid") {
    return <div className="confirm">
      <motion.div className="ticket-card" role="status" aria-live="polite" initial={reduce ? false : { opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}>
        <span className="label">You’re in</span>
        <h1>You’re in — early access confirmed.</h1>
        <p>You’re on the early-access list. We’ll email you if a concierge place opens.</p>
      </motion.div>
      <div className="panel">
        <p className="kicker">What happens next</p>
        <ol className="next-list">
          <li><span className="how-step">1</span><span>We review your answers and contact you if a concierge place opens.</span></li>
          <li><span className="how-step">2</span><span>You choose which photos or screenshots to share. NoSwipe prepares profile copy, message drafts and date plans.</span></li>
          <li><span className="how-step">3</span><span>You keep control of every dating-app account, choose who to like, send every message and confirm every date.</span></li>
        </ol>
        <p className="fine" style={{ marginTop: 16 }}>Your reservation payment is refundable: just reply to your confirmation email or write to support@noswipe.app. We can’t guarantee dates, and nobody honestly can.</p>
        <p style={{ fontWeight: 800, marginTop: 22 }}>Know a guy who’s sick of swiping?</p>
        <div className="share-row"><ShareButton /><Link href="/" className="btn btn-primary">Back to NoSwipe</Link></div>
      </div>
    </div>;
  }

  let heading = "Checking your payment…";
  let detail = "Stripe is confirming your payment. Early access is confirmed only after we verify it, which usually takes a few seconds.";
  let tone = "waiting";
  if (!checking && data?.status === "pending") { heading = "Still confirming."; detail = "Your payment hasn’t been verified yet. Refresh this page in a minute. If you were charged, your confirmation will appear here."; }
  if (data?.status === "refunded") { heading = "Your payment was refunded."; detail = "The payment went back to your original payment method, and the early-access reservation was cancelled."; tone = "muted"; }
  if (data?.status === "expired") { heading = "Checkout wasn’t completed."; detail = "No payment was taken and no reservation was created. You can try again any time."; tone = "muted"; }
  if (message) { heading = "We couldn’t load this reservation."; tone = "muted"; }

  return <div className="confirm">
    <div className={`ticket-card ${tone}`} role="status" aria-live="polite">
      <span className="label">Early access</span>
      <h1>{heading}</h1>
      <p>{message ? `${message}. Check the link from your Stripe receipt, or start a new reservation.` : detail}</p>
      {checking && <p style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700 }}><span className="spinner" aria-hidden="true" /> Verifying with Stripe</p>}
      <div className="perf">The return from Checkout alone doesn’t confirm payment.</div>
    </div>
    <div className="share-row" style={{ alignSelf: "start" }}>
      {(data?.status === "expired" || data?.status === "refunded" || message) && <Link href="/reserve" className="btn btn-primary">Get started again</Link>}
      <Link href="/" className="btn btn-white">Back to NoSwipe</Link>
    </div>
  </div>;
}
