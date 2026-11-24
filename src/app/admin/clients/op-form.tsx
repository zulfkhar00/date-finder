"use client";

import { useActionState, type ReactNode } from "react";
import type { OpState } from "./actions";
import styles from "../admin.module.css";

/** One admin operation: fields in, a server action, a result line. The button disables and spins while it runs. */
export function OpForm({ action, label, pendingLabel, children, encType }: {
  action: (prev: OpState, formData: FormData) => Promise<OpState>; label: string; pendingLabel?: string; children: ReactNode; encType?: string;
}) {
  const [state, formAction, pending] = useActionState<OpState, FormData>(action, {});
  return (
    <form action={formAction} encType={encType} style={{ display: "grid", gap: 10 }} onSubmit={(e) => { const tz = e.currentTarget.elements.namedItem("tzOffset"); if (tz instanceof HTMLInputElement) tz.value = String(new Date().getTimezoneOffset()); }}>
      {children}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button type="submit" className={styles.button} disabled={pending} aria-busy={pending}>
          {pending ? <span className={styles.spinner} aria-hidden /> : null}{pending ? (pendingLabel ?? "Saving…") : label}
        </button>
        {state.error ? <span className={styles.error} role="alert">{state.error}</span> : null}
        {state.ok && !pending ? <span className={styles.success} role="status">{state.ok}</span> : null}
      </div>
    </form>
  );
}

/** Hidden field holding the admin browser's IANA zone ("Europe/London"), read when the form is submitted. */
export function TzName() {
  return <input type="hidden" name="timezone" defaultValue="" ref={(el) => { if (el && !el.value) { try { el.value = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* the server falls back */ } } }} />;
}

/** Hidden field; OpForm fills it with the admin browser's UTC offset on submit so a typed local time is stored correctly. */
export function TzOffset() {
  return <input type="hidden" name="tzOffset" defaultValue="0" />;
}
