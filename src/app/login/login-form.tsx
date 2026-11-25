"use client";

import { useActionState, useState } from "react";
import { requestCode, verifyCode, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [attempt, setAttempt] = useState(0);
  return <Steps key={attempt} initialError={attempt === 0 ? initialError : undefined} restart={() => setAttempt((n) => n + 1)} />;
}

function Steps({ initialError, restart }: { initialError?: string; restart: () => void }) {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(requestCode, { step: "email", error: initialError });
  const [verified, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });

  if (sent.step !== "code" || !sent.email) {
    return (
      <form action={sendAction} className="app-form">
        <label className="app-field">
          <span>Email</span>
          <input type="email" name="email" autoComplete="email" inputMode="email" required defaultValue={sent.email ?? ""} readOnly={sending} placeholder="you@example.com" />
        </label>
        {sent.error ? <p className="app-error" role="alert">{sent.error}</p> : null}
        <button type="submit" className="app-btn" disabled={sending} aria-busy={sending}>
          {sending ? <><span className="app-spinner" aria-hidden /> Sending…</> : "Email me a code"}
        </button>
      </form>
    );
  }
  return (
    <form action={verifyAction} className="app-form">
      <p className="app-sub" role="status">Code sent to <strong>{sent.email}</strong></p>
      <input type="hidden" name="email" value={sent.email} />
      <label className="app-field">
        <span>Code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required readOnly={verifying} autoFocus />
      </label>
      {verified.error ? <p className="app-error" role="alert">{verified.error}</p> : null}
      {sent.error ? <p className="app-error" role="alert">{sent.error}</p> : null}
      <button type="submit" className="app-btn" disabled={verifying} aria-busy={verifying}>
        {verifying ? <><span className="app-spinner" aria-hidden /> Checking…</> : "Sign in"}
      </button>
      <div className="app-auth-links">
        <button type="submit" className="app-link" formAction={sendAction} formNoValidate disabled={verifying || sending} aria-busy={sending}>{sending ? "Sending…" : sent.notice ? "Sent" : "Resend code"}</button>
        <button type="button" className="app-link" onClick={restart} disabled={verifying}>Change email</button>
      </div>
    </form>
  );
}
