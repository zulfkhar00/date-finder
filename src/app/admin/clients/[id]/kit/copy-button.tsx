"use client";

import { useState } from "react";
import styles from "../../../admin.module.css";

/** Copies text to the clipboard. Disabled for the moment the copy is in flight; says "Copied" afterwards. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  async function copy() {
    setState("busy");
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button type="button" className={styles.buttonGhost} onClick={copy} disabled={state === "busy" || !text} aria-busy={state === "busy"}>
      {state === "busy" ? <span className={styles.spinner} aria-hidden /> : null}
      {state === "done" ? "Copied" : state === "failed" ? "Copy failed" : label}
    </button>
  );
}

/** Fetches the zip, then saves it. The button is disabled with a spinner while the server builds it. */
export function ZipButton({ href, label }: { href: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function download() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "kit-photos.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error && e.message && e.message.length < 120 ? e.message : "Could not build the zip.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <button type="button" className={styles.button} onClick={download} disabled={busy} aria-busy={busy}>
        {busy ? <span className={styles.spinner} aria-hidden /> : null}{busy ? "Building zip…" : label}
      </button>
      {error ? <span className={styles.error} role="alert">{error}</span> : null}
    </span>
  );
}
