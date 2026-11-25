"use client";

import { useActionState } from "react";
import { submitAppealAction, type AppealState } from "@/lib/reports/actions";
import { When } from "@/components/app/when";

export type HoldNoticeView = {
  hold: "paused" | "closed";
  ref: string;
  /** ISO time the decision was made. */
  since: string;
  appeal: "can_appeal" | "submitted" | "decided_upheld" | "expired";
  /** ISO deadline of the 14-day window. */
  deadline: string;
};

/** Shown to a user whose account was paused or closed after a report. They can appeal once, within 14 days. */
export function HoldNotice({ notice }: { notice: HoldNoticeView }) {
  const [state, formAction, pending] = useActionState<AppealState, FormData>(submitAppealAction, {});
  const closed = notice.hold === "closed";
  const submitted = notice.appeal === "submitted" || !!state.ok;
  return (
    <section className="app-card" role="region" aria-labelledby="hold-title" data-testid="hold-notice" style={{ margin: "16px 16px 0", display: "grid", gap: 12, borderColor: "var(--grape)", borderWidth: 2 }}>
      <h2 id="hold-title" style={{ fontSize: 20, fontWeight: 800 }}>{closed ? "Your account is closed." : "Your account is paused."}</h2>
      <p>
        After a report that your account broke our acceptable use policy, we {closed ? "closed it" : "paused it"}. {closed ? "Nothing runs on your dating apps and you can no longer use NoSwipe." : "Nothing runs on your dating apps until this is resolved."}{" "}
        Reference <strong data-testid="hold-ref">{notice.ref}</strong>.
      </p>
      {submitted ? (
        <p role="status" style={{ fontWeight: 700 }}>{state.ok ?? "We have your appeal. A different reviewer looks at it within 7 days and we email you the answer."}</p>
      ) : notice.appeal === "decided_upheld" ? (
        <p>Your appeal was reviewed and the decision stands. If you have new information, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
      ) : notice.appeal === "expired" ? (
        <p>The 14-day appeal window ended on <When iso={notice.deadline} style="short" />. If you think this is a mistake, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
      ) : (
        <form action={formAction} style={{ display: "grid", gap: 10 }}>
          <label htmlFor="appeal" style={{ fontWeight: 800 }}>Appeal this decision</label>
          <p style={{ fontSize: 14 }}>You can appeal until <When iso={notice.deadline} style="short" />. Tell us why you think it was a mistake. We do not tell you who reported you.</p>
          <textarea id="appeal" name="appeal" required minLength={10} maxLength={2000} rows={5} className="app-input" style={{ padding: "12px 16px", minHeight: 120 }} aria-describedby={state.error ? "appeal-error" : undefined} aria-invalid={state.error ? true : undefined} />
          {state.error ? <p id="appeal-error" role="alert" style={{ color: "#B3261E", fontWeight: 700 }}>{state.error}</p> : null}
          <button type="submit" className="app-btn" disabled={pending} aria-busy={pending}>{pending ? "Sending…" : "Send appeal"}</button>
        </form>
      )}
    </section>
  );
}
