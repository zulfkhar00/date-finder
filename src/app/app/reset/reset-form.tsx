"use client";

import { useActionState } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/app/owner";
import { setOwnerPassword, type OwnerLoginState } from "../login/actions";

export function ResetForm() {
  const [state, action, pending] = useActionState<OwnerLoginState, FormData>(setOwnerPassword, {});
  return (
    <form action={action} className="app-form">
      <label className="app-field">
        <span>New password</span>
        <input type="password" name="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required readOnly={pending} />
      </label>
      <label className="app-field">
        <span>Repeat it</span>
        <input type="password" name="confirm" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required readOnly={pending} />
      </label>
      <p className="app-fine" style={{ marginTop: 0 }}>At least {MIN_PASSWORD_LENGTH} characters.</p>
      {state.error ? <p className="app-error" role="alert">{state.error}</p> : null}
      <button type="submit" className="app-btn" disabled={pending} aria-busy={pending}>
        {pending ? <><span className="app-spinner" aria-hidden /> Saving…</> : "Save password"}
      </button>
    </form>
  );
}
