"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/attribution-client";
import { requestCode, verifyCodeInline, type LoginState } from "@/app/login/actions";

/**
 * The email-code sign-in, placed inside onboarding after the first questions so a visitor sees
 * what NoSwipe asks for before being asked for an email. Calls onSignedIn once the code checks out.
 */
export function AccountStep({ onSignedIn, onCodeSent }: { onSignedIn: () => void; onCodeSent?: (sent: boolean) => void }) {
  const [attempt, setAttempt] = useState(0);
  return <Inner key={attempt} onSignedIn={onSignedIn} onCodeSent={onCodeSent} restart={() => { onCodeSent?.(false); setAttempt((n) => n + 1); }} />;
}

function Inner({ onSignedIn, onCodeSent, restart }: { onSignedIn: () => void; onCodeSent?: (sent: boolean) => void; restart: () => void }) {
  const [sent, sendAction, sending] = useActionState<LoginState, FormData>(requestCode, { step: "email" });
  const [verified, verifyAction, verifying] = useActionState<LoginState, FormData>(verifyCodeInline, { step: "code" });
  const fired = useRef(false);
  const verifyForm = useRef<HTMLFormElement>(null);
  const autoSubmit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(autoSubmit.current), []);
  const [finishing, setFinishing] = useState(false);
  // The server says "New code sent." for every send; only worth showing once the visitor asked for another one.
  const [resent, setResent] = useState(false);
  useEffect(() => {
    if (verified.step === "done" && !fired.current) { fired.current = true; setFinishing(true); onSignedIn(); }
  }, [verified.step, onSignedIn]);

  const codeSent = sent.step === "code" && Boolean(sent.email);
  useEffect(() => { onCodeSent?.(codeSent); if (codeSent) trackEvent("ob_code_sent", { oncePerSession: true }); }, [codeSent, onCodeSent]);

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
        <p className="app-fine" style={{ marginTop: 0 }}><a href="/terms" target="_blank" rel="noreferrer">Terms</a> · <a href="/privacy" target="_blank" rel="noreferrer">Privacy</a></p>
      </form>
    );
  }
  return (
    <form ref={verifyForm} action={verifyAction} className="app-form" style={{ marginTop: 22 }}>
      <p className="app-sub" role="status">Code sent to <strong>{sent.email}</strong>{resent && sent.notice ? <><br />{sent.notice}</> : null}</p>
      <input type="hidden" name="email" value={sent.email} />
      <label className="app-field">
        <span>Code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" maxLength={10} required readOnly={verifying || finishing} autoFocus
          onChange={(e) => {
            // Submit by itself once a full code is in (a short pause, so a longer code isn't cut off while typing).
            clearTimeout(autoSubmit.current);
            if (/^\d{6,10}$/.test(e.currentTarget.value.trim())) autoSubmit.current = setTimeout(() => verifyForm.current?.requestSubmit(), 700);
          }} />
      </label>
      {verified.error ? <p className="app-error" role="alert">{verified.error}</p> : null}
      <button type="submit" className="app-btn" disabled={verifying || finishing} aria-busy={verifying || finishing}>
        {verifying || finishing ? <><span className="app-spinner" aria-hidden /> {finishing ? "Saving…" : "Checking…"}</> : "Continue"}
      </button>
      <div className="app-auth-links">
        <button type="submit" className="app-link" formAction={sendAction} formNoValidate onClick={() => setResent(true)} disabled={verifying || sending || finishing} aria-busy={sending}>{sending ? "Sending…" : "Resend code"}</button>
        <button type="button" className="app-link" onClick={restart} disabled={verifying || finishing}>Change email</button>
      </div>
    </form>
  );
}
