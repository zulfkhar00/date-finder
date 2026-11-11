"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/attribution-client";
import { requestCode, verifyCodeInline, type LoginState } from "@/app/login/actions";

/**
 * The email-code sign-in, placed inside onboarding after the first questions so a visitor sees
 * what NoSwipe asks for before being asked for an email. Calls onSignedIn once the code checks out.
 */
export function AccountStep({ onSignedIn }: { onSignedIn: () => void }) {
  const [attempt, setAttempt] = useState(0);
  return <Inner key={attempt} onSignedIn={onSignedIn} restart={() => setAttempt((n) => n + 1)} />;
}

function Inner({ onSignedIn, restart }: { onSignedIn: () => void; restart: () => void }) {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(requestCode, { step: "email" });
  const [verified, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCodeInline, { step: "code" });
  const fired = useRef(false);
  const [finishing, setFinishing] = useState(false);
  useEffect(() => {
    if (verified.step === "done" && !fired.current) { fired.current = true; setFinishing(true); onSignedIn(); }
  }, [verified.step, onSignedIn]);

  const codeSent = sent.step === "code" && Boolean(sent.email);
  useEffect(() => { if (codeSent) trackEvent("ob_code_sent", { oncePerSession: true }); }, [codeSent]);

  if (sent.step !== "code" || !sent.email) {
    return (
      <form action={sendAction} className="app-form" style={{ marginTop: 22 }}>
        <label className="app-field">
          <span className="sr-only">Email</span>
          <input type="email" name="email" autoComplete="email" inputMode="email" required autoFocus defaultValue={sent.email ?? ""} readOnly={sending} placeholder="you@example.com" />
        </label>
        {sent.error ? <p className="app-error" role="alert">{sent.error}</p> : null}
        <button type="submit" className="app-btn" disabled={sending} aria-busy={sending}>
          {sending ? <><span className="app-spinner" aria-hidden /> Sending…</> : "Email me a code"}
        </button>
        <p className="app-fine" style={{ marginTop: 0 }}>No password. By continuing you agree to the <a href="/terms" target="_blank" rel="noreferrer">terms</a> and <a href="/privacy" target="_blank" rel="noreferrer">privacy note</a>.</p>
      </form>
    );
  }
  return (
    <form action={verifyAction} className="app-form" style={{ marginTop: 22 }}>
      <p className="app-ok" role="status">We emailed a code to <strong>{sent.email}</strong>. Type it here.</p>
      <input type="hidden" name="email" value={sent.email} />
      <label className="app-field">
        <span>Code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required readOnly={verifying || finishing} autoFocus />
      </label>
      {verified.error ? <p className="app-error" role="alert">{verified.error}</p> : null}
      <button type="submit" className="app-btn" disabled={verifying || finishing} aria-busy={verifying || finishing}>
        {verifying || finishing ? <><span className="app-spinner" aria-hidden /> {finishing ? "Saving…" : "Checking…"}</> : "Continue"}
      </button>
      <p className="app-fine" style={{ marginTop: 0 }}>Nothing yet? Check spam or promotions.</p>
      <button type="submit" className="app-link" formAction={sendAction} formNoValidate disabled={verifying || sending || finishing} aria-busy={sending}>{sending ? "Sending…" : "Send a new code"}</button>
      {sent.notice && !sending ? <p className="app-ok" role="status">{sent.notice}</p> : null}
      <button type="button" className="app-link" onClick={restart} disabled={verifying || finishing}>Use a different email</button>
    </form>
  );
}
