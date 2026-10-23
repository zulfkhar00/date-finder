"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import styles from "../admin.module.css";

/** Submit button that disables itself and shows a spinner while its form's action runs. */
export function SubmitButton({ children, pendingLabel, ghost = false }: { children: ReactNode; pendingLabel?: string; ghost?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={ghost ? styles.buttonGhost : styles.button} disabled={pending} aria-busy={pending}>
      {pending ? <span className={styles.spinner} aria-hidden /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
