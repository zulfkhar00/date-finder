"use client";

import { useActionState, useState } from "react";
import type { NotesState } from "../../_lib/actions";
import { LEAD_STAGES, type LeadStage } from "../../_lib/data-shared";
import styles from "../../admin.module.css";

const LABELS: Record<LeadStage, string> = { new: "New", contacted: "Contacted", pilot: "Pilot", declined: "Declined" };

export function NotesForm({
  action,
  stage,
  notes,
  disabled
}: {
  action: (state: NotesState, formData: FormData) => Promise<NotesState>;
  stage: LeadStage;
  notes: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Controlled, so React's automatic form reset after the action doesn't revert the fields.
  const [stageValue, setStageValue] = useState<LeadStage>(stage);
  const [notesValue, setNotesValue] = useState(notes);
  return (
    <form action={formAction} style={{ display: "grid", gap: 12 }}>
      <label className={styles.field}>
        Stage
        <select className={styles.select} name="stage" value={stageValue} onChange={(e) => setStageValue(e.target.value as LeadStage)} disabled={disabled || pending}>
          {LEAD_STAGES.map((value) => <option key={value} value={value}>{LABELS[value]}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        Notes (visible to admins only)
        <textarea className={styles.textarea} name="notes" value={notesValue} onChange={(e) => setNotesValue(e.target.value)} maxLength={5000} readOnly={pending} disabled={disabled} />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button type="submit" className={styles.button} disabled={disabled || pending} aria-busy={pending}>
          {pending ? <span className={styles.spinner} aria-hidden /> : null}
          {pending ? "Saving…" : "Save"}
        </button>
        {state.error ? <span className={styles.error} role="alert">{state.error}</span> : null}
        {state.ok && !pending ? <span className={styles.success} role="status">Saved</span> : null}
      </div>
    </form>
  );
}
