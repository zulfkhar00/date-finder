"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createInvite, decideDraft, newInviteCode, requestMagicLink, saveClient, saveTracker, signOut, type ActionState } from "./actions";
import styles from "./operator.module.css";

const APPS = ["Tinder", "Bumble", "Hinge", "Badoo"];

/** Disabled with a spinner while its form is in flight. Every async button in the console uses this. */
function SubmitButton({ children, intent, ghost, pendingLabel }: { children: React.ReactNode; intent?: string; ghost?: boolean; pendingLabel?: string }) {
  const { pending, data } = useFormStatus();
  const mine = pending && (!intent || data?.get("intent") === intent);
  return (
    <button type="submit" name={intent ? "intent" : undefined} value={intent} disabled={pending} aria-busy={mine} className={`${styles.button} ${ghost ? styles.buttonGhost : ""}`}>
      {mine && <span className={styles.spinner} aria-hidden="true" />}
      {mine ? pendingLabel ?? "Working…" : children}
    </button>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return <span role="status" className={state.ok ? styles.ok : styles.err}>{state.message}</span>;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(requestMagicLink, null);
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <label className={styles.label} htmlFor="email">Operator email</label>
      <input className={styles.input} id="email" name="email" type="email" autoComplete="email" required />
      <div className={styles.row}>
        <SubmitButton pendingLabel="Sending link…">Email me a sign-in link</SubmitButton>
      </div>
      <p><Status state={state} /></p>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOut}>
      <SubmitButton ghost pendingLabel="Signing out…">Sign out</SubmitButton>
    </form>
  );
}

export function DraftDecision({ id, message, canSend, sendLabel = "Approve & send" }: { id: string; message: string; canSend: boolean; sendLabel?: string }) {
  const [state, action] = useActionState(decideDraft, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      {canSend && <>
        <label className={styles.label} htmlFor={`message-${id}`}>Message to the client (edit before sending if needed)</label>
        <textarea className={styles.textarea} id={`message-${id}`} name="message" defaultValue={message} />
      </>}
      <label className={styles.label} htmlFor={`note-${id}`}>Note (kept with the draft if you reject)</label>
      <input className={styles.input} id={`note-${id}`} name="note" maxLength={2000} />
      <div className={styles.row}>
        {canSend && <SubmitButton intent="send" pendingLabel="Sending…">{sendLabel}</SubmitButton>}
        <SubmitButton intent="reject" ghost pendingLabel="Rejecting…">{canSend ? "Reject" : "Dismiss"}</SubmitButton>
        <Status state={state} />
      </div>
    </form>
  );
}

function InviteResult({ state }: { state: ActionState }) {
  if (!state?.code) return null;
  return (
    <div className={styles.block}>
      <h4>Invite code (valid 14 days, single use)</h4>
      <span className={styles.code}>{state.code}</span>
      <p className={styles.meta}>
        {state.link ? <>Send him this link: <a href={state.link}>{state.link}</a></> : <>Tell him to open the bot and send <code>/start {state.code}</code>. Set TELEGRAM_BOT_USERNAME to get a one-tap link.</>}
      </p>
    </div>
  );
}

function AppChecks({ selected = [] }: { selected?: string[] }) {
  return (
    <div className={styles.checks}>
      {APPS.map((app) => <label key={app}><input type="checkbox" name="apps" value={app} defaultChecked={selected.includes(app)} />{app}</label>)}
    </div>
  );
}

export function InviteForm() {
  const [state, action] = useActionState(createInvite, null);
  return (
    <form action={action} className={styles.card}>
      <div className={styles.cardTitle}>New client invite</div>
      <div className={styles.inline}>
        <div><label className={styles.label} htmlFor="invite-name">First name</label><input className={styles.input} id="invite-name" name="name" maxLength={120} required /></div>
        <div><label className={styles.label} htmlFor="invite-email">Reservation email (optional)</label><input className={styles.input} id="invite-email" name="reservationEmail" type="email" /></div>
        <div><span className={styles.label}>Apps</span><AppChecks selected={["Tinder"]} /></div>
      </div>
      <label className={styles.label} htmlFor="invite-voice">Voice notes: facts about him and how he texts (only what he told us)</label>
      <textarea className={`${styles.textarea} ${styles.textareaSmall}`} id="invite-voice" name="voiceNotes" maxLength={4000} />
      <div className={styles.row}><SubmitButton pendingLabel="Creating…">Create invite code</SubmitButton><Status state={state} /></div>
      <InviteResult state={state} />
    </form>
  );
}

export function NewCodeForm({ id }: { id: string }) {
  const [state, action] = useActionState(newInviteCode, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.row}><SubmitButton ghost pendingLabel="Generating…">New invite code</SubmitButton><Status state={state} /></div>
      <InviteResult state={state} />
    </form>
  );
}

export function ClientEditForm({ id, voiceNotes, apps, status }: { id: string; voiceNotes: string; apps: string[]; status: string }) {
  const [state, action] = useActionState(saveClient, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <label className={styles.label} htmlFor={`voice-${id}`}>Voice notes</label>
      <textarea className={`${styles.textarea} ${styles.textareaSmall}`} id={`voice-${id}`} name="voiceNotes" defaultValue={voiceNotes} maxLength={4000} />
      <div className={styles.inline}>
        <div><span className={styles.label}>Apps</span><AppChecks selected={apps} /></div>
        <div>
          <label className={styles.label} htmlFor={`status-${id}`}>Status</label>
          <select className={styles.select} id={`status-${id}`} name="status" defaultValue={status}>
            <option value="pilot">Pilot</option><option value="paused">Paused</option><option value="done">Done</option>
          </select>
        </div>
      </div>
      <div className={styles.row}><SubmitButton pendingLabel="Saving…">Save client</SubmitButton><Status state={state} /></div>
    </form>
  );
}

export function TrackerForm({ id }: { id: string }) {
  const [state, action] = useActionState(saveTracker, null);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <div className={styles.inline}>
        <div><label className={styles.label} htmlFor={`m-${id}`}>Matches this week</label><input className={styles.input} id={`m-${id}`} name="matchesWeek" type="number" min={0} inputMode="numeric" /></div>
        <div><label className={styles.label} htmlFor={`c-${id}`}>Active convos</label><input className={styles.input} id={`c-${id}`} name="convos" type="number" min={0} inputMode="numeric" /></div>
        <div><label className={styles.label} htmlFor={`d-${id}`}>Dates scheduled (total)</label><input className={styles.input} id={`d-${id}`} name="datesScheduled" type="number" min={0} inputMode="numeric" /></div>
      </div>
      <label className={styles.label} htmlFor={`n-${id}`}>Note</label>
      <input className={styles.input} id={`n-${id}`} name="note" maxLength={500} />
      <div className={styles.row}><SubmitButton pendingLabel="Saving…">Save snapshot</SubmitButton><Status state={state} /></div>
    </form>
  );
}
