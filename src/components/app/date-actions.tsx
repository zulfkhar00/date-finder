"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { respondToDate } from "@/lib/app/actions";

type R = { ok: true } | { ok: false; error: string };
export type DateApi = { respond: (id: string, response: "confirmed" | "declined") => Promise<R> };
export const realDateApi: DateApi = { respond: respondToDate };

/** Confirm or decline a date the team booked. Both buttons disable while the answer is being saved; declining asks once. */
export function DateActions({ id, who, api = realDateApi }: { id: string; who: string; api?: DateApi }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "confirmed" | "declined">("");
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState<"" | "confirmed" | "declined">("");
  const [error, setError] = useState("");

  async function answer(response: "confirmed" | "declined") {
    if (busy) return;
    setBusy(response); setError(""); setAsking(false);
    try {
      const r = await api.respond(id, response);
      if (r.ok) { setDone(response); router.refresh(); } else setError(r.error);
    } catch {
      setError("Couldn't reach NoSwipe. Check your connection and try again.");
    } finally {
      setBusy("");
    }
  }

  if (done) return <p className="app-fine" role="status" style={{ margin: 0 }}>{done === "confirmed" ? `Confirmed. See you there.` : `Declined. We'll let ${who} know it's off and look for another time.`}</p>;
  return (
    <div className="date-actions">
      {asking ? (
        <>
          <p className="app-fine" style={{ margin: 0, flexBasis: "100%" }}>Decline the date with {who}?</p>
          <button type="button" className="app-btn danger small" onClick={() => answer("declined")} disabled={busy !== ""} aria-busy={busy === "declined"}>{busy === "declined" ? <><span className="app-spinner" aria-hidden /> Declining…</> : "Yes, decline"}</button>
          <button type="button" className="app-btn ghost small" onClick={() => setAsking(false)} disabled={busy !== ""}>Keep it</button>
        </>
      ) : (
        <>
          <button type="button" className="app-btn small" onClick={() => answer("confirmed")} disabled={busy !== ""} aria-busy={busy === "confirmed"}>{busy === "confirmed" ? <><span className="app-spinner" aria-hidden /> Confirming…</> : <><Check size={16} aria-hidden /> Confirm</>}</button>
          <button type="button" className="app-btn ghost small" onClick={() => setAsking(true)} disabled={busy !== ""}><X size={16} aria-hidden /> Decline</button>
        </>
      )}
      {error ? <p className="app-error" role="alert" style={{ flexBasis: "100%", margin: 0 }}>{error}</p> : null}
    </div>
  );
}
