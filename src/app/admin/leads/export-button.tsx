"use client";

import { useRef, useState } from "react";
import styles from "../admin.module.css";

const FALLBACK_NAME = "noswipe-leads.csv";

function filenameFrom(disposition: string | null): string {
  const match = disposition?.match(/filename="([^"]+)"/);
  return match?.[1] ?? FALLBACK_NAME;
}

/**
 * Downloads the CSV with fetch → blob, so the button can stay disabled while the export runs
 * and a second click can't start a parallel export.
 */
export function ExportButton({ href, label }: { href: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function onClick() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(href, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) {
        setError(response.status === 404 ? "Your session has ended. Sign in again." : "Export failed. Try again in a moment.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(response.headers.get("Content-Disposition"));
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Export failed. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={styles.exportWrap}>
      <button type="button" className={styles.buttonGhost} onClick={onClick} disabled={busy} aria-busy={busy}>
        {busy ? <span className={styles.spinner} aria-hidden /> : null}
        {busy ? "Exporting…" : label}
      </button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}
