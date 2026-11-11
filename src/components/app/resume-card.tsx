"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { EmbeddedPayment } from "@/components/embedded-payment";
import { captureAttribution, getFunnelSessionId, trackEvent } from "@/lib/attribution-client";
import { readCheckoutResponse, type EmbeddedPayment as Payment } from "@/lib/checkout-presentation";
import { RESUME_COPY, buildResumePayload, pollUntilPaid, type ResumeData } from "@/lib/app/resume";

type Phase = "idle" | "opening" | "paying" | "confirming" | "done";

/** "Finish setting up": the way back to paying for someone who finished onboarding and has not paid. */
export function ResumeCard({ data }: { data: ResumeData }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");
  const opening = useRef(false);
  const sessionId = useRef<string | null>(null);

  useEffect(() => { trackEvent("resume_card_view", { oncePerSession: true }); }, []);

  const confirm = useCallback(async (id: string | null) => {
    await pollUntilPaid(async () => {
      if (!id) return "paid";
      const r = await fetch(`/api/reservation-status?session_id=${encodeURIComponent(id)}`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { status?: string }).status ?? null : null;
    });
    // Paid or still unconfirmed at the 10 s limit: both end in the success state. Stripe already
    // completed the payment, the webhook is just late. There is never a second pay button.
    setPhase("done");
    router.refresh();
  }, [router]);

  async function open() {
    if (opening.current) return; // double tap: one request
    opening.current = true;
    setPhase("opening"); setError("");
    trackEvent("resume_card_click");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildResumePayload(data, { attribution: captureAttribution(), funnelSessionId: getFunnelSessionId() }))
      });
      const result = await res.json().catch(() => ({}));
      if (res.status === 409) { setPhase("confirming"); void confirm(null); return; } // already paid
      if (!res.ok) throw new Error(result.error || RESUME_COPY.retry);
      const checkout = readCheckoutResponse(result);
      if (checkout.mode === "embedded") { sessionId.current = checkout.sessionId; setPayment(checkout); setPhase("paying"); }
      else window.location.assign(checkout.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : RESUME_COPY.retry);
      setPhase("idle");
    } finally {
      opening.current = false;
    }
  }

  const onComplete = useCallback(() => { setPayment(null); setPhase("confirming"); void confirm(sessionId.current); }, [confirm]);

  if (phase === "paying" && payment) {
    return <section className="app-card resume-card" aria-label="Activate NoSwipe"><EmbeddedPayment neutral payment={payment} onComplete={onComplete} onBack={() => { setPayment(null); setPhase("idle"); }} /></section>;
  }
  if (phase === "confirming") {
    return <section className="app-card resume-card" role="status" aria-live="polite"><p style={{ fontWeight: 800 }}><span className="app-spinner" aria-hidden /> {RESUME_COPY.confirming}</p></section>;
  }
  if (phase === "done") {
    return <section className="app-card resume-card" role="status" aria-live="polite"><CheckCircle2 size={24} aria-hidden /><h2 className="resume-title">{RESUME_COPY.doneTitle}</h2><p className="app-sub">{RESUME_COPY.doneBody}</p></section>;
  }
  const busy = phase === "opening";
  return (
    <section className="app-card resume-card" aria-labelledby="resume-title">
      <h2 id="resume-title" className="resume-title">{RESUME_COPY.title}</h2>
      <p className="app-sub">{RESUME_COPY.body}</p>
      {error ? <p className="app-error" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}
      <button type="button" className="app-btn" style={{ marginTop: 14 }} onClick={() => void open()} disabled={busy} aria-busy={busy}>
        {busy ? <><span className="app-spinner" aria-hidden /> {RESUME_COPY.opening}</> : <><Lock size={18} aria-hidden /> {RESUME_COPY.button}</>}
      </button>
    </section>
  );
}
