"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CATEGORIES, CATEGORY_LABELS, DATING_APPS, DATING_APP_LABELS, LIMITS, SUBJECT_KINDS, SUBJECT_LABELS, isUrgentCategory, sniffImage, type Category } from "@/lib/reports/core";
import styles from "./report.module.css";

const CATEGORY_HINTS: Partial<Record<Category, string>> = {
  minor_safety: "Someone who looks or says they are under 18, or content involving a minor.",
  trafficking: "Someone being forced, controlled, sold or moved, or commercial sex.",
  non_consensual_images: "Intimate images shared or threatened without consent.",
  threats: "Threats of violence or harm to a person."
};

type Fields = Partial<Record<"email" | "subjectKind" | "datingApp" | "description" | "category" | "screenshot", string>>;

function EmergencyGuidance({ minor, images }: { minor: boolean; images: boolean }) {
  return (
    <div className={styles.dangerBox} role="note" data-testid="emergency-guidance">
      <h2>If someone is in danger right now, call emergency services first.</h2>
      <ul>
        <li>In the US or Canada call 911. In the UK call 999. In Australia call 000. In New Zealand call 111. Elsewhere, use your local emergency number.</li>
        {minor ? <li>Child sexual exploitation can also be reported to the <a href="https://report.cybertip.org/" target="_blank" rel="noopener noreferrer">NCMEC CyberTipline</a>.</li> : null}
        {images ? <li>To get intimate images removed: <a href="https://takeitdown.ncmec.org/" target="_blank" rel="noopener noreferrer">Take It Down</a> (under 18) or <a href="https://stopncii.org/" target="_blank" rel="noopener noreferrer">StopNCII.org</a> (adults).</li> : null}
      </ul>
      <p>Then send this form. We treat it as urgent and look at it within 4 hours.</p>
    </div>
  );
}

export function ReportForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const [pending, setPending] = useState(false);
  const [fields, setFields] = useState<Fields>({});
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category | "">("");
  const [danger, setDanger] = useState(false);
  const [length, setLength] = useState(0);
  const [done, setDone] = useState<{ ref: string; email: boolean; danger: boolean } | null>(null);

  useEffect(() => { if (done) doneRef.current?.focus(); }, [done]);
  useEffect(() => { if (error || Object.keys(fields).length) summaryRef.current?.focus(); }, [error, fields]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const next: Fields = {};
    if (!data.get("subjectKind")) next.subjectKind = "Choose what you are reporting.";
    if (!data.get("category")) next.category = "Choose a category.";
    if (!String(data.get("description") ?? "").trim()) next.description = "Tell us what happened.";
    const file = data.get("screenshot");
    if (file instanceof File && file.size > 0) {
      if (file.size > LIMITS.upload) next.screenshot = "The screenshot is too large. Use one under 4 MB.";
      else if (!sniffImage(new Uint8Array(await file.slice(0, 12).arrayBuffer()))) next.screenshot = "Use a JPG, PNG or WebP screenshot.";
    } else data.delete("screenshot");
    if (Object.keys(next).length) { setFields(next); setError("Please fix the highlighted fields."); return; }

    setFields({}); setError(null); setPending(true);
    try {
      const res = await fetch("/api/report", { method: "POST", body: data });
      const body = (await res.json().catch(() => ({}))) as { ref?: string; error?: string; fields?: Fields };
      if (res.ok && body.ref) {
        setDone({ ref: body.ref, email: !!String(data.get("email") ?? "").trim(), danger: data.get("inDanger") === "on" });
        return;
      }
      setFields(body.fields ?? {});
      setError(body.error ?? "Something went wrong and your report was not saved. Please try again, or email support@noswipe.app.");
    } catch {
      setError("That didn't send. Check your connection and try again. Your answers are still here.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <section className={styles.done} aria-labelledby="report-done" data-testid="report-confirmation">
        <h2 id="report-done" tabIndex={-1} ref={doneRef}>We have your report.</h2>
        <p className={styles.refLabel}>Your reference number</p>
        <p className={styles.ref} data-testid="report-ref">{done.ref}</p>
        <p>Keep this number. It is the only way to refer to this report.</p>
        <ul>
          {done.email
            ? <li>We respond to the email address you gave within 24 hours. We do not send an automatic confirmation email, so nothing will arrive until we have something to tell you.</li>
            : <li>You did not give an email address, so we cannot reply to you. We still review every report. To follow up, email <a href="mailto:support@noswipe.app">support@noswipe.app</a> and quote the reference.</li>}
          <li>We acknowledge reports within 24 hours and aim to resolve them within 72 hours. Reports about minors, trafficking, intimate images or threats come first, with a 4 hour target.</li>
        </ul>
        {done.danger ? <EmergencyGuidance minor={false} images={false} /> : null}
        <p><Link href="/acceptable-use">Read the acceptable use policy</Link></p>
      </section>
    );
  }

  const showMinor = category === "minor_safety";
  const showImages = category === "non_consensual_images";
  const showGuidance = danger || (category !== "" && isUrgentCategory(category));
  const fieldProps = (name: keyof Fields) => ({ "aria-invalid": fields[name] ? true : undefined, "aria-describedby": fields[name] ? `err-${name}` : undefined });

  return (
    <form ref={formRef} className={styles.form} onSubmit={onSubmit} noValidate aria-busy={pending} data-testid="report-form">
      {error ? <div className={styles.summary} role="alert" tabIndex={-1} ref={summaryRef}>{error}</div> : null}

      <fieldset className={styles.group} aria-describedby={fields.subjectKind ? "err-subjectKind" : undefined}>
        <legend className={styles.legend}>What are you reporting?</legend>
        <div className={styles.options}>
          {SUBJECT_KINDS.map((k) => <label key={k} className={styles.option}><input type="radio" name="subjectKind" value={k} /> {SUBJECT_LABELS[k]}</label>)}
        </div>
        {fields.subjectKind ? <p id="err-subjectKind" className={styles.fieldError}>{fields.subjectKind}</p> : null}
      </fieldset>

      <fieldset className={styles.group} aria-describedby={fields.category ? "err-category" : undefined}>
        <legend className={styles.legend}>What kind of problem is it?</legend>
        <div className={styles.options}>
          {CATEGORIES.map((c) => (
            <label key={c} className={styles.option}>
              <input type="radio" name="category" value={c} checked={category === c} onChange={() => setCategory(c)} />
              <span>{CATEGORY_LABELS[c]}{CATEGORY_HINTS[c] ? <small>{CATEGORY_HINTS[c]}</small> : null}</span>
            </label>
          ))}
        </div>
        {fields.category ? <p id="err-category" className={styles.fieldError}>{fields.category}</p> : null}
      </fieldset>

      <label className={styles.danger}>
        <input type="checkbox" name="inDanger" checked={danger} onChange={(e) => setDanger(e.target.checked)} />
        <span>Someone is in danger or has been threatened right now</span>
      </label>
      {showGuidance ? <EmergencyGuidance minor={showMinor} images={showImages} /> : null}

      <div className={styles.group}>
        <label className={styles.label} htmlFor="datingApp">Which dating app? <span className={styles.optional}>(optional)</span></label>
        <select id="datingApp" name="datingApp" className={styles.select} defaultValue="" {...fieldProps("datingApp")}>
          <option value="">Not sure or not on an app</option>
          {DATING_APPS.map((a) => <option key={a} value={a}>{DATING_APP_LABELS[a]}</option>)}
        </select>
        {fields.datingApp ? <p id="err-datingApp" className={styles.fieldError}>{fields.datingApp}</p> : null}
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="profileRef">Profile name or link <span className={styles.optional}>(optional)</span></label>
        <input id="profileRef" name="profileRef" className={styles.input} maxLength={LIMITS.profileRef} autoComplete="off" placeholder="Name as shown, or a link to the profile" />
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="description">What happened?</label>
        <p className={styles.hint} id="description-hint">Say what you saw or experienced, when, and anything that helps us find it. Do not include passwords or codes.</p>
        <textarea id="description" name="description" className={`${styles.textarea} ${fields.description ? styles.invalid : ""}`} maxLength={LIMITS.description} required aria-required="true"
          aria-describedby={fields.description ? "description-hint err-description" : "description-hint"} aria-invalid={fields.description ? true : undefined} onChange={(e) => setLength(e.target.value.length)} />
        <p className={styles.counter} aria-hidden="true">{length} / {LIMITS.description}</p>
        {fields.description ? <p id="err-description" className={styles.fieldError}>{fields.description}</p> : null}
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="screenshot">Screenshot <span className={styles.optional}>(optional)</span></label>
        <p className={styles.hint} id="screenshot-hint">One JPG, PNG or WebP, up to 4 MB. It is stored privately and only our safety team can open it.</p>
        <input id="screenshot" name="screenshot" type="file" accept="image/jpeg,image/png,image/webp" className={`${styles.input} ${fields.screenshot ? styles.invalid : ""}`} style={{ paddingTop: 12 }}
          aria-describedby={fields.screenshot ? "screenshot-hint err-screenshot" : "screenshot-hint"} aria-invalid={fields.screenshot ? true : undefined} />
        {fields.screenshot ? <p id="err-screenshot" className={styles.fieldError}>{fields.screenshot}</p> : null}
      </div>

      <div className={styles.group}>
        <label className={styles.label} htmlFor="email">Your email <span className={styles.optional}>(optional)</span></label>
        <p className={styles.hint} id="email-hint">Leave it empty to report anonymously. If you give it, we reply there within 24 hours. We never send you an automatic email, and we do not share it with the person you report.</p>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={LIMITS.email} className={`${styles.input} ${fields.email ? styles.invalid : ""}`}
          aria-describedby={fields.email ? "email-hint err-email" : "email-hint"} aria-invalid={fields.email ? true : undefined} />
        {fields.email ? <p id="err-email" className={styles.fieldError}>{fields.email}</p> : null}
      </div>

      <div className={styles.honey} aria-hidden="true">
        <label htmlFor="website">Leave this field empty</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={styles.actions}>
        <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
          {pending ? <><span className={styles.spinner} aria-hidden="true" /> Sending…</> : "Send report"}
        </button>
      </div>
      <p className={styles.fine}>Prefer email? Write to <a href="mailto:support@noswipe.app">support@noswipe.app</a>. Law enforcement: see the <Link href="/law-enforcement">law enforcement protocol</Link>.</p>
    </form>
  );
}
