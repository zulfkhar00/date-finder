"use client";

import { Check } from "lucide-react";
import { APPS, APP_LABELS, GENDERS, GOALS, GOAL_LABELS, HANDOFF_LABELS, HANDOFF_METHODS, INTERESTED_IN, appConsentLine, type App, type StepName } from "@/lib/app/domain";
import { DEFAULT_HANDOFF, type Connection, type Draft } from "@/lib/app/draft";

export const GENDER_LABELS: Record<string, string> = { man: "Man", woman: "Woman", nonbinary: "Non-binary" };
export const INTEREST_LABELS: Record<string, string> = { men: "Men", women: "Women", nonbinary: "Non-binary people" };
const APP_NOTES: Record<App, string> = { tinder: "Swipe-first", hinge: "Prompts and conversation", bumble: "Her move, or yours" };
export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className="app-chip" aria-pressed={on} onClick={onClick}>{on ? <Check size={16} strokeWidth={3} aria-hidden /> : null}{children}</button>;
}

type Props = { step: StepName; d: Draft; set: (patch: Partial<Draft>) => void; compact?: boolean };

function List3({ label, values, onChange, placeholders }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholders: string[] }) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 10 }}>
      <legend className="app-legend" style={{ marginBottom: 8 }}>{label}</legend>
      {values.map((v, i) => (
        <input key={i} className="app-input" aria-label={`${label} ${i + 1}`} value={v} maxLength={60} placeholder={placeholders[i]} onChange={(e) => onChange(values.map((x, j) => (j === i ? e.target.value : x)))} />
      ))}
    </fieldset>
  );
}

export function StepFields({ step, d, set, compact }: Props) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  if (step === "name") return (
    <label className="app-field"><span className={compact ? undefined : "sr-only"}>First name</span>
      <input autoFocus={!compact} autoComplete="given-name" name="given-name" maxLength={60} value={d.firstName} onChange={(e) => set({ firstName: e.target.value })} placeholder="First name" /></label>
  );
  if (step === "birthday") return (
    <label className="app-field"><span className={compact ? undefined : "sr-only"}>Birthday</span>
      <input type="date" autoComplete="bday" value={d.birthday} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ birthday: e.target.value })} /></label>
  );
  if (step === "who") return (
    <div style={{ display: "grid", gap: 22 }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="app-legend" style={{ marginBottom: 10 }}>I am</legend>
        <div className="app-chips">{GENDERS.map((g) => <Chip key={g} on={d.gender === g} onClick={() => set({ gender: g })}>{GENDER_LABELS[g]}</Chip>)}</div></fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="app-legend" style={{ marginBottom: 10 }}>I want to meet</legend>
        <div className="app-chips">{INTERESTED_IN.map((g) => <Chip key={g} on={d.interestedIn.includes(g)} onClick={() => set({ interestedIn: toggle(d.interestedIn, g) })}>{INTEREST_LABELS[g]}</Chip>)}</div></fieldset>
    </div>
  );
  if (step === "about") return (
    <div className="app-form" style={{ marginTop: 0 }}>
      <label className="app-field"><span>Job</span><input autoComplete="organization-title" maxLength={120} value={d.job} onChange={(e) => set({ job: e.target.value })} placeholder="e.g. Product designer" /></label>
      <label className="app-field"><span>Height in cm <em style={{ fontWeight: 600, color: "var(--grape-3)" }}>(optional)</em></span><input inputMode="numeric" maxLength={3} value={d.heightCm} onChange={(e) => set({ heightCm: e.target.value.replace(/\D/g, "") })} placeholder="e.g. 180" /></label>
      <List3 label="Three interests" values={d.interests} onChange={(interests) => set({ interests })} placeholders={["Hiking", "Cooking", "Live music"]} />
    </div>
  );
  if (step === "type") return (
    <div className="app-form" style={{ marginTop: 0 }}>
      <label className="app-field"><span>Where are you based?</span><input autoComplete="address-level2" maxLength={120} value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder="City" /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="app-field"><span>Age from</span><input inputMode="numeric" maxLength={2} value={d.ageMin} onChange={(e) => set({ ageMin: e.target.value.replace(/\D/g, "") })} placeholder="24" /></label>
        <label className="app-field"><span>Age to</span><input inputMode="numeric" maxLength={2} value={d.ageMax} onChange={(e) => set({ ageMax: e.target.value.replace(/\D/g, "") })} placeholder="32" /></label>
      </div>
      <label className="app-field"><span>How far, in km?</span><input inputMode="numeric" maxLength={5} value={d.distanceKm} onChange={(e) => set({ distanceKm: e.target.value.replace(/\D/g, "") })} /></label>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend className="app-legend" style={{ marginBottom: 10 }}>Looking for</legend>
        <div style={{ display: "grid", gap: 8 }}>{GOALS.map((g) => <button type="button" key={g} className="app-choice" aria-pressed={d.lookingFor === g} onClick={() => set({ lookingFor: g })}>{GOAL_LABELS[g]}</button>)}</div></fieldset>
      <List3 label="Three dealbreakers" values={d.dealbreakers} onChange={(dealbreakers) => set({ dealbreakers })} placeholders={["Smokes", "Doesn't want kids", "Rude to waiters"]} />
    </div>
  );
  return <ConnectApps d={d} set={set} compact={compact} />;
}

/**
 * "Connect your apps": per app, the client says yes to NoSwipe running it and picks how they hand it over. Nothing here asks for a
 * password or any login detail: the handoff happens later, with a person on our team, on a phone we set aside for them.
 */
export function ConnectApps({ d, set, compact }: { d: Draft; set: (patch: Partial<Draft>) => void; compact?: boolean }) {
  const conn = (a: App): Connection => d.connections?.[a] ?? { handoff: DEFAULT_HANDOFF, consent: false };
  const patchConn = (a: App, p: Partial<Connection>) => set({ connections: { ...d.connections, [a]: { ...conn(a), ...p } } });
  function toggleApp(a: App) {
    if (d.apps.includes(a)) {
      const rest = { ...d.connections };
      delete rest[a];
      set({ apps: d.apps.filter((x) => x !== a), connections: rest });
    } else set({ apps: [...d.apps, a], connections: { ...d.connections, [a]: { handoff: DEFAULT_HANDOFF, consent: false } } });
  }
  return (
    <div style={{ display: "grid", gap: 12, marginTop: compact ? 0 : 20 }} data-testid="connect-apps">
      {APPS.map((a) => {
        const on = d.apps.includes(a);
        const c = conn(a);
        return (
          <div key={a} className="app-connect" data-on={on ? "true" : undefined} data-app-card={a}>
            <button type="button" className="app-choice" aria-pressed={on} onClick={() => !c.locked && toggleApp(a)} disabled={on && c.locked === true} aria-label={`${APP_LABELS[a]}${on ? ", connected" : ""}`}>
              <span className="app-badge" data-app={a} aria-hidden="true">{APP_LABELS[a][0]}</span>
              <span style={{ flex: 1 }}>{APP_LABELS[a]}<small>{APP_NOTES[a]}</small></span>
              {on ? <Check size={22} strokeWidth={3} aria-hidden /> : null}
            </button>
            {on ? (
              <div className="app-connect-body">
                {c.locked ? <p className="app-fine" style={{ margin: 0 }}>Connected. You agreed that NoSwipe runs this app. Pause or resume it from Home.</p> : (
                  <>
                    <fieldset style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: 8 }}>
                      <legend className="app-legend" style={{ marginBottom: 8 }}>How do we get in?</legend>
                      {HANDOFF_METHODS.map((m) => (
                        <button type="button" key={m} className="app-choice app-handoff" aria-pressed={c.handoff === m} onClick={() => patchConn(a, { handoff: m })}>
                          <span style={{ flex: 1 }}>{HANDOFF_LABELS[m].title}<small>{HANDOFF_LABELS[m].note}</small></span>
                          {c.handoff === m ? <Check size={20} strokeWidth={3} aria-hidden /> : null}
                        </button>
                      ))}
                    </fieldset>
                    <label className="ob-check"><input type="checkbox" checked={c.consent} onChange={(e) => patchConn(a, { consent: e.target.checked })} /><span>{appConsentLine(a)}</span></label>
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="app-fine" style={{ margin: 0 }}>We never ask for your password on this site. You can pause an app, take it over or disconnect it any time from Home.</p>
    </div>
  );
}
