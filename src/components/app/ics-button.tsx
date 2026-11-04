"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { buildIcs, type DateRow } from "@/lib/app/domain";

/** Builds the .ics in the browser and downloads it. Nothing is sent to a server. */
export function IcsButton({ date }: { date: DateRow }) {
  const [busy, setBusy] = useState(false);
  function download() {
    setBusy(true);
    try {
      const blob = new Blob([buildIcs(date)], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `date-with-${date.who.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "match"}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setTimeout(() => setBusy(false), 400);
    }
  }
  return (
    <button type="button" className="app-btn" onClick={download} disabled={busy} aria-busy={busy}>
      {busy ? <><span className="app-spinner" aria-hidden /> Preparing…</> : <><CalendarPlus size={20} aria-hidden /> Add to calendar</>}
    </button>
  );
}
