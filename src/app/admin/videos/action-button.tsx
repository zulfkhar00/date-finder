"use client";

import { useActionState } from "react";
import type { ContentActionState } from "./actions";
import styles from "../admin.module.css";

/** One request button (Post anyway / Don't post). Disabled with a spinner while the request is saved. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  ghost = false
}: {
  action: (state: ContentActionState) => Promise<ContentActionState>;
  label: string;
  pendingLabel: string;
  ghost?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const busy = pending || Boolean(state.ok);
  return (
    <form action={formAction} className={styles.videoAction}>
      <button type="submit" className={ghost ? styles.buttonGhost : styles.button} disabled={busy} aria-busy={pending}>
        {pending ? <span className={styles.spinner} aria-hidden /> : null}
        {pending ? pendingLabel : state.ok ? "Requested" : label}
      </button>
      {state.error ? <p className={styles.error} role="alert">{state.error}</p> : null}
    </form>
  );
}
