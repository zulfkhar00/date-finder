"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "../admin.module.css";

/**
 * Plain GET form (filters survive reloads and are shareable as URLs). The button disables and
 * shows a spinner until the next page loads; a back/forward restore resets it.
 */
export function GetForm({ action, children, submitLabel }: { action: string; children: ReactNode; submitLabel: string }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <form action={action} method="get" className={styles.filters} onSubmit={() => setPending(true)}>
      {children}
      <button type="submit" className={styles.button} disabled={pending} aria-busy={pending}>
        {pending ? <span className={styles.spinner} aria-hidden /> : null}
        {pending ? "Loading…" : submitLabel}
      </button>
    </form>
  );
}
