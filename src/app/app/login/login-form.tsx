"use client";

import { useActionState, useState } from "react";
import { requestReset, signInOwner, type OwnerLoginState } from "./actions";

export function OwnerLoginForm({ initialError }: { initialError?: string }) {
  const [forgot, setForgot] = useState(false);
  const [signedIn, signInAction, signingIn] = useActionState<OwnerLoginState, FormData>(signInOwner, { error: initialError });
  const [reset, resetAction, resetting] = useActionState<OwnerLoginState, FormData>(requestReset, {});

  if (forgot) {
    return (
      <form action={resetAction} className="app-form">
        <p className="app-sub" style={{ marginTop: 0 }}>Enter your email and we&rsquo;ll send you a link to choose a new password.</p>
        <label className="app-field">
          <span>Email</span>
          <input type="email" name="email" autoComplete="email" inputMode="email" required readOnly={resetting} placeholder="you@example.com" />
        </label>
        {reset.error ? <p className="app-error" role="alert">{reset.error}</p> : null}
        {reset.notice && !resetting ? <p className="app-ok" role="status">{reset.notice}</p> : null}
        <button type="submit" className="app-btn" disabled={resetting} aria-busy={resetting}>
          {resetting ? <><span className="app-spinner" aria-hidden /> Sending…</> : "Email me a reset link"}
        </button>
        <button type="button" className="app-link" onClick={() => setForgot(false)} disabled={resetting}>Back to sign in</button>
      </form>
    );
  }
  return (
    <form action={signInAction} className="app-form">
      <label className="app-field">
        <span>Email</span>
        <input type="email" name="email" autoComplete="username" inputMode="email" required readOnly={signingIn} placeholder="you@example.com" />
      </label>
      <label className="app-field">
        <span>Password</span>
        <input type="password" name="password" autoComplete="current-password" required readOnly={signingIn} />
      </label>
      {signedIn.error ? <p className="app-error" role="alert">{signedIn.error}</p> : null}
      <button type="submit" className="app-btn" disabled={signingIn} aria-busy={signingIn}>
        {signingIn ? <><span className="app-spinner" aria-hidden /> Signing in…</> : "Sign in"}
      </button>
      <button type="button" className="app-link" onClick={() => setForgot(true)} disabled={signingIn}>Forgot password?</button>
    </form>
  );
}
