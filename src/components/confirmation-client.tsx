"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = { status: "pending" | "paid" | "refunded" | "expired"; position: number | null };

export function ConfirmationClient({ sessionId }: { sessionId: string | undefined }) {
  const [data, setData] = useState<Status | null>(null);
  const [message, setMessage] = useState(sessionId ? "" : "This reservation link is incomplete.");
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

  let heading = "A moment while we verify.";
  let detail = "Stripe is confirming your payment. Your place is assigned only after our payment webhook verifies it.";
  if (data?.status === "paid") { heading = "Your place is reserved."; detail = "Your $1 early-access reservation is confirmed. We will contact you if concierge access opens for your city. Joining the concierge would be a separate decision with separate pricing; a reservation does not guarantee an invitation or a date."; }
  if (data?.status === "refunded") { heading = "Your payment was refunded."; detail = "The $1 payment has been returned to the original payment method. Your waitlist place is no longer active."; }
  if (data?.status === "expired") { heading = "Checkout was not completed."; detail = "No waitlist place was assigned. You can return to the reservation form to try again."; }

  return <><h1>{heading}</h1><p>{detail}</p><div className="status-box" role="status" aria-live="polite"><span>Reservation status</span><strong>{checking ? "Checking payment…" : data?.status === "paid" && data.position ? `No. ${String(data.position).padStart(4, "0")}` : data?.status === "refunded" ? "Refunded" : data?.status === "expired" ? "Not reserved" : "Awaiting verification"}</strong><p>{data?.status === "paid" ? "Waitlist numbers are assigned in the order successful payments are verified." : "The return from Checkout alone does not confirm payment."}</p></div>{message && <p className="form-error" role="alert">{message}</p>}<div className="confirmation-actions"><Button asChild><Link href="/">Return to Morrow <ArrowUpRight size={18} /></Link></Button></div></>;
}
