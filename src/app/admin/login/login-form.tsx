"use client";

import { useActionState, useState } from "react";
import { requestLoginLink, verifyLoginCode, type LoginState } from "../_lib/actions";
import styles from "../admin.module.css";

/** Two steps: email → (click the emailed link, or type the emailed code). */
export function LoginForm({ initialError }: { initialError?: string }) {
  const [attempt, setAttempt] = useState(0);
  return <LoginSteps key={attempt} initialError={attempt === 0 ? initialError : undefined} onRestart={() => setAttempt((n) => n + 1)} />;
}

function LoginSteps({ initialError, onRestart }: { initialError?: string; onRestart: () => void }) {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(requestLoginLink, { step: "email", error: initialError });
  const [verified, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyLoginCode, { step: "code" });

  if (sent.step !== "code" || !sent.email) {
    return (
      <form action={sendAction}>
        <label className={styles.field}>
          Email
          <input className={styles.input} type="email" name="email" autoComplete="email" required defaultValue={sent.email ?? ""} readOnly={sending} />
        </label>
        {sent.error ? <p className={styles.error} role="alert">{sent.error}</p> : null}
        <button type="submit" className={styles.button} disabled={sending} aria-busy={sending}>
          {sending ? <span className={styles.spinner} aria-hidden /> : null}
          {sending ? "Sending…" : "Email me a sign-in link"}
        </button>
      </form>
    );
  }

  return (
    <form action={verifyAction}>
      <p className={styles.success}>{sent.message}</p>
      <input type="hidden" name="email" value={sent.email} />
      <label className={styles.field}>
        One-time code
        <input className={styles.input} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required readOnly={verifying} />
      </label>
      {verified.error ? <p className={styles.error} role="alert">{verified.error}</p> : null}
      <button type="submit" className={styles.button} disabled={verifying} aria-busy={verifying}>
        {verifying ? <span className={styles.spinner} aria-hidden /> : null}
        {verifying ? "Checking…" : "Sign in"}
      </button>
      <button type="button" className={styles.linkButton} onClick={onRestart} disabled={verifying}>
        Use a different email
      </button>
    </form>
  );
}
