"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Pencil } from "lucide-react";
import { AppBadge, StatusPill } from "@/components/app/ui";
import { PhotoManager, realPhotoApi, type PhotoApi } from "@/components/app/photo-manager";
import { StepFields } from "@/components/app/step-fields";
import { payloadFor, type Draft } from "@/lib/app/draft";
import { deleteAccount, saveSettings, saveStep, setAppPaused, signOutUser } from "@/lib/app/actions";
import { APP_LABELS, GOAL_LABELS, VOICES, VOICE_LABELS, effectiveStatus, type AppAccountRow, type StepName } from "@/lib/app/domain";
import type { Photo } from "@/lib/app/data";

type R = { ok: true } | { ok: false; error: string };
export type ProfileApi = {
  saveStep: (step: StepName, payload: unknown) => Promise<R>;
  setAppPaused: (app: string, paused: boolean) => Promise<R>;
  saveSettings: (input: { voice: string; notifyEmail: boolean }) => Promise<R>;
  deleteAccount: (confirm: string) => Promise<R | void>;
  signOut: () => Promise<void>;
  photos: PhotoApi;
};
export const realProfileApi: ProfileApi = { saveStep, setAppPaused, saveSettings, deleteAccount, signOut: signOutUser, photos: realPhotoApi };

function EditCard({ title, step, draft, summary, api }: { title: string; step: StepName; draft: Draft; summary: React.ReactNode; api: ProfileApi }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(draft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    const r = await api.saveStep(step, payloadFor(step, d));
    setBusy(false);
    if (!r.ok) { setError(r.error); return; }
    setOpen(false); router.refresh();
  }
  return (
    <section className="app-card" aria-label={title}>
      <div className="app-sec">
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
        {!open ? <button type="button" className="app-btn ghost small" onClick={() => setOpen(true)}><Pencil size={16} aria-hidden /> Edit</button> : null}
      </div>
      {open ? (
        <div style={{ marginTop: 14 }}>
          <StepFields step={step} d={d} set={(p) => setD((x) => ({ ...x, ...p }))} compact />
          {error ? <p className="app-error" role="alert" style={{ marginTop: 10 }}>{error}</p> : null}
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            <button type="button" className="app-btn small" onClick={save} disabled={busy} aria-busy={busy}>{busy ? <><span className="app-spinner" aria-hidden /> Saving…</> : "Save"}</button>
            <button type="button" className="app-btn ghost small" onClick={() => { setD(draft); setOpen(false); setError(""); }} disabled={busy}>Cancel</button>
          </div>
        </div>
      ) : <div style={{ marginTop: 10 }}>{summary}</div>}
    </section>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className="app-switch" disabled={disabled} onClick={() => onChange(!on)} />;
}

function AppRow({ account, api }: { account: AppAccountRow; api: ProfileApi }) {
  const router = useRouter();
  const [paused, setPaused] = useState(account.user_paused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(next: boolean) {
    setBusy(true); setError(""); setPaused(next);
    const r = await api.setAppPaused(account.app, next);
    if (!r.ok) { setPaused(!next); setError(r.error); }
    setBusy(false); router.refresh();
  }
  const s = effectiveStatus({ status: account.status, user_paused: paused });
  return (
    <li className="app-row">
      <AppBadge app={account.app} />
      <div className="app-row-body">
        <div className="app-row-title">{APP_LABELS[account.app]} <StatusPill account={{ status: account.status, user_paused: paused }} /></div>
        <div className="app-row-sub" style={{ whiteSpace: "normal" }}>{error || (s === "paused" ? "Paused. Nothing is sent for you." : s === "live" ? "Running." : "We're setting it up.")}</div>
      </div>
      <Toggle on={!paused} onChange={(on) => change(!on)} disabled={busy} label={`${APP_LABELS[account.app]} ${paused ? "paused, turn on" : "running, pause"}`} />
    </li>
  );
}

export function ProfileClient({ email, age, draft, photos, apps, voice, notifyEmail, api = realProfileApi }: { email: string; age: number | null; draft: Draft; photos: Photo[]; apps: AppAccountRow[]; voice: string; notifyEmail: boolean; api?: ProfileApi }) {
  const router = useRouter();
  const [v, setV] = useState(voice);
  const [notify, setNotify] = useState(notifyEmail);
  const [saved, setSaved] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [word, setWord] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [delError, setDelError] = useState("");

  async function persist(nextVoice: string, nextNotify: boolean) {
    setSaved("Saving…");
    const r = await api.saveSettings({ voice: nextVoice, notifyEmail: nextNotify });
    setSaved(r.ok ? "Saved" : r.error);
    router.refresh();
  }
  async function remove() {
    setDeleting(true); setDelError("");
    const r = await api.deleteAccount(word);
    if (r && !r.ok) { setDelError(r.error); setDeleting(false); }
  }

  return (
    <>
      <h1 className="app-h1">{draft.firstName || "You"}{age ? `, ${age}` : ""}</h1>
      <p className="app-sub">{email}</p>

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <section className="app-card" aria-label="Photos">
          <h2 style={{ fontSize: 17, fontWeight: 800 }}>Photos</h2>
          <PhotoManager initial={photos} api={api.photos} />
        </section>

        <EditCard api={api} title="About you" step="about" draft={draft} summary={
          <dl className="app-kv"><dt>Job</dt><dd>{draft.job || "—"}</dd><dt>Height</dt><dd>{draft.heightCm ? `${draft.heightCm} cm` : "—"}</dd><dt>Interests</dt><dd>{draft.interests.filter(Boolean).join(", ") || "—"}</dd></dl>} />
        <EditCard api={api} title="Your type" step="type" draft={draft} summary={
          <dl className="app-kv"><dt>City</dt><dd>{draft.city || "—"}</dd><dt>Ages</dt><dd>{draft.ageMin && draft.ageMax ? `${draft.ageMin}–${draft.ageMax}` : "—"}</dd><dt>Distance</dt><dd>{draft.distanceKm ? `${draft.distanceKm} km` : "—"}</dd>
            <dt>Looking for</dt><dd>{GOAL_LABELS[draft.lookingFor as keyof typeof GOAL_LABELS] ?? "—"}</dd><dt>Dealbreakers</dt><dd>{draft.dealbreakers.filter(Boolean).join(", ") || "—"}</dd></dl>} />

        <section aria-label="Connected apps">
          <h2 className="app-h2" style={{ marginTop: 10 }}>Connected apps</h2>
          {apps.length ? <ul className="app-list">{apps.map((a) => <AppRow key={a.app} account={a} api={api} />)}</ul> : <div className="app-empty">No apps yet.</div>}
          <p className="app-fine">Pause an app and nothing is sent for you there until you turn it back on.</p>
        </section>

        <section className="app-card" aria-label="Voice and notifications">
          <h2 style={{ fontSize: 17, fontWeight: 800 }}>How you sound</h2>
          <p className="app-fine" style={{ marginTop: 4 }}>The tone we use when we chat as you.</p>
          <div className="app-chips" style={{ marginTop: 12 }} role="group" aria-label="Tone">
            {VOICES.map((x) => <button key={x} type="button" className="app-chip" aria-pressed={v === x} onClick={() => { setV(x); void persist(x, notify); }}>{VOICE_LABELS[x]}</button>)}
          </div>
          <div className="app-sec" style={{ marginTop: 18 }}>
            <div><strong>Email me</strong><div className="app-fine" style={{ marginTop: 2 }}>When a date is booked or a chat needs you.</div></div>
            <Toggle on={notify} onChange={(on) => { setNotify(on); void persist(v, on); }} label="Email notifications" />
          </div>
          <p className="app-fine" role="status" aria-live="polite">{saved}</p>
        </section>

        <form action={api.signOut} onSubmit={() => setSigningOut(true)}>
          <button type="submit" className="app-btn ghost" disabled={signingOut} aria-busy={signingOut}>{signingOut ? <><span className="app-spinner" aria-hidden /> Signing out…</> : <><LogOut size={18} aria-hidden /> Sign out</>}</button>
        </form>

        <section className="app-card" aria-label="Delete account">
          <h2 style={{ fontSize: 17, fontWeight: 800 }}>Delete account</h2>
          <p className="app-fine" style={{ marginTop: 4 }}>Deletes your profile, photos, chats and dates from NoSwipe for good. This can&rsquo;t be undone.</p>
          {!confirmDelete ? <button type="button" className="app-btn ghost small" style={{ marginTop: 12, color: "#B3261E" }} onClick={() => setConfirmDelete(true)}>Delete my account</button> : (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <label className="app-field"><span>Type DELETE to confirm</span><input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></label>
              {delError ? <p className="app-error" role="alert">{delError}</p> : null}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="app-btn danger small" disabled={deleting || word.trim().toLowerCase() !== "delete"} aria-busy={deleting} onClick={remove}>{deleting ? <><span className="app-spinner" aria-hidden /> Deleting…</> : "Delete everything"}</button>
                <button type="button" className="app-btn ghost small" disabled={deleting} onClick={() => { setConfirmDelete(false); setWord(""); }}>Cancel</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
