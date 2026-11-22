import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { APPS, APP_LABELS, STATUS_LABELS, effectiveStatus, type App, type AppStatus } from "@/lib/app/domain";
import { getRunPanel } from "@/lib/activity/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CHECKLIST_STEPS, NEEDS_YOU_TEMPLATES, STEP_LABELS, progress } from "@/lib/operator/checklist";
import { APP_LIMITS, KIT_SECTIONS, SECTION_LABELS, convertClock, sectionText, type KitSection, type KitSections } from "@/lib/operator/kit";
import { kitAllowed, listKits, listTicks } from "@/lib/operator/service";
import { livePhotoRows } from "@/lib/starter-pack/photo-flags";
import { LocalTime } from "../../../_components/local-time";
import { SetupNotice } from "../../../_components/notices";
import { clientActionDoneAction, generateKitAction, regenerateSectionAction, requestActionAction, restartSetupAction, setTimezoneAction, tickStepAction } from "../../actions";
import { OpForm } from "../../op-form";
import { CopyButton, ZipButton } from "./copy-button";
import styles from "../../../admin.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Account kit" };

export default async function AdminKitPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = getSupabaseAdmin();
  const [{ data: profile }, { data: accounts }, gate, kitsRes, ticksRes, run, photos] = await Promise.all([
    sb.from("profiles").select("first_name, internal, report_hold").eq("user_id", id).maybeSingle(),
    sb.from("app_accounts").select("app, status, user_paused, client_action_reason, status_changed_at").eq("user_id", id),
    kitAllowed(sb, id),
    listKits(sb, id),
    listTicks(sb, id),
    getRunPanel(sb, id),
    livePhotoRows<{ id: string; path: string }>(sb, id, "id, path")
  ]);
  if (!profile) notFound();
  const held = (profile.report_hold as string | null) ?? null;
  const signed = photos.length ? (await sb.storage.from("profile-photos").createSignedUrls(photos.map((p) => p.path), 600)).data ?? [] : [];
  const urlOf = new Map(signed.map((u) => [u.path, u.signedUrl]));
  const pathOf = new Map(photos.map((p) => [p.id, p.path]));
  const tz = Object.values(kitsRes.kits).find((k) => k?.timezone)?.timezone ?? "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.sub}><Link href={`/admin/clients/${id}`} className={styles.rowLink}>← Client</Link> · <Link href="/admin/fulfilment" className={styles.rowLink}>Queue</Link></p>
          <h1>Account kit · {profile.first_name || "Unnamed"} {profile.internal ? <span className={styles.badge} data-testid="internal-badge">internal</span> : null}</h1>
          <p className={styles.sub}>What to type into each app, the creation checklist, and what to ask the client for. The client never sees this page. Times show in your time zone unless marked.</p>
        </div>
      </div>

      {kitsRes.setupNeeded || ticksRes.setupNeeded ? <div className={styles.notice}>The kit and checklist are not set up yet. Apply <code>supabase/2026-11-22-operator-kit.sql</code>.</div> : null}
      {held ? <div className={styles.notice}>A report put this client on hold ({held}). Nothing runs on any app until it is lifted, whatever the checklist says.</div> : null}
      {!gate.allowed ? <div className={styles.notice} data-testid="kit-unpaid">This client has not paid yet, so the kit is not made. It unlocks when their payment arrives.</div> : null}
      {profile.internal ? <div className={styles.notice}>Internal account: excluded from metrics and from the 48 h alert. Everything else works as for a client.</div> : null}

      <section className={styles.card}>
        <h2 className={styles.subhead}>Client time zone</h2>
        <OpForm action={setTimezoneAction.bind(null, id)} label="Save time zone" pendingLabel="Saving…">
          <label className={styles.field}>IANA zone (e.g. America/Los_Angeles, Europe/London)
            <input className={styles.input} name="timezone" defaultValue={tz} maxLength={64} placeholder="America/Los_Angeles" /></label>
        </OpForm>
        <p className={styles.sub}>{tz ? `Date windows below read in ${tz} and in UTC.` : "Not set. Date windows read in the client's local time, whatever it is: ask or infer it from their city before booking."}</p>
      </section>

      {APPS.map((app) => {
        const row = (accounts ?? []).find((a) => a.app === app) as { app: App; status: AppStatus; user_paused: boolean; client_action_reason: string | null; status_changed_at: string | null } | undefined;
        if (!row) return null;
        const status = effectiveStatus(row);
        const ticks = ticksRes.ticks[app] ?? [];
        const prog = progress(ticks);
        const tickOf = new Map(ticks.map((t) => [t.step, t]));
        const phone = run.assignments[app]?.phoneId ?? null;
        const kit = kitsRes.kits[app];
        const sections = (kit?.sections ?? {}) as Partial<KitSections>;
        const lim = APP_LIMITS[app];
        return (
          <section key={app} className={styles.card} data-testid={`kit-${app}`}>
            <h2 className={styles.subhead}>{APP_LABELS[app]} <span className={styles.badge} data-testid={`status-${app}`}>{row.user_paused ? "paused by client" : STATUS_LABELS[row.status]}</span> {phone ? <span className={styles.badge}>{phone}</span> : <span className={styles.muted}>no phone</span>}</h2>
            {row.user_paused ? <div className={styles.notice}>The client paused {APP_LABELS[app]}{row.status === "setting_up" ? " mid-setup" : ""}. You can keep setting it up, but it will not go active until they resume.</div> : null}
            {status === "needs_client_action" ? <p className={styles.sub}>Client sees: {row.client_action_reason}</p> : null}

            <h3 className={styles.subhead} style={{ marginTop: 14 }}>Creation checklist <span className={styles.badge}>{prog.done}/{prog.total}</span></h3>
            <div style={{ display: "grid", gap: 8 }}>
              {CHECKLIST_STEPS.map((step) => {
                const t = tickOf.get(step);
                return (
                  <div key={step} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--a-line)", paddingTop: 8 }} data-step={step} data-done={t ? "true" : "false"}>
                    <div style={{ flex: "1 1 240px" }}>
                      <strong>{t ? "✓ " : ""}{STEP_LABELS[step]}</strong>
                      {t ? <p className={styles.sub}>{t.doneBy} · <LocalTime iso={t.doneAt} /></p> : null}
                    </div>
                    {step === "assign_phone" ? <span className={styles.muted}>Follows the Run panel</span> : (
                      <OpForm action={tickStepAction.bind(null, id, app, step, !t)} label={t ? "Undo" : "Mark done"} pendingLabel="Saving…"><span /></OpForm>
                    )}
                  </div>
                );
              })}
            </div>
            <p className={styles.sub} style={{ marginTop: 8 }}>When the last step is ticked and the app is still Setting up, it becomes Active by itself (the phone then starts running it). Each tick is logged with who and when.</p>

            <h3 className={styles.subhead} style={{ marginTop: 14 }}>Needs the client</h3>
            {status === "needs_client_action" ? (
              <OpForm action={clientActionDoneAction.bind(null, id, app)} label="Client did it: back to setting up" pendingLabel="Saving…"><span /></OpForm>
            ) : null}
            {status !== "closed" ? (
              <OpForm action={requestActionAction.bind(null, id, app)} label="Ask the client" pendingLabel="Saving…">
                <div className={styles.filters}>
                  <label className={styles.field}>Template
                    <select className={styles.select} name="template" defaultValue={NEEDS_YOU_TEMPLATES[0].id}>
                      {NEEDS_YOU_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></label>
                  <label className={styles.field} style={{ flex: "2 1 240px" }}>Or your own words (replaces the template)
                    <input className={styles.input} name="custom" maxLength={200} /></label>
                </div>
              </OpForm>
            ) : null}
            {(row.status === "closed" || row.status === "paused") && !row.user_paused ? (
              <OpForm action={restartSetupAction.bind(null, id, app)} label="Restart setup (clears the checklist)" pendingLabel="Restarting…"><span className={styles.muted}>Use when the client comes back after a pause or close.</span></OpForm>
            ) : null}

            <h3 className={styles.subhead} style={{ marginTop: 14 }}>Kit</h3>
            {!kit ? (
              <OpForm action={generateKitAction.bind(null, id, app)} label="Generate kit" pendingLabel="Generating…">
                <span className={styles.muted}>Built from onboarding and the starter pack. {gate.allowed ? "" : "Locked until the client has paid."}</span>
              </OpForm>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <p className={styles.sub}>Generated <LocalTime iso={kit.generatedAt} />, last change by {kit.updatedBy}. Limits for {APP_LABELS[app]}: bio {lim.bio}{lim.prompts ? `, ${lim.prompts} prompts of ${lim.promptAnswer}` : ", no prompts"}, up to {lim.photos} photos.</p>
                {KIT_SECTIONS.map((section) => {
                  const data = sections[section];
                  const text = data ? sectionText(section, sections as KitSections) : "";
                  return (
                    <div key={section} style={{ borderTop: "1px solid var(--a-line)", paddingTop: 10, display: "grid", gap: 8 }} data-section={section}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <strong style={{ flex: "1 1 160px" }}>{SECTION_LABELS[section]}</strong>
                        {section === "photos" && data ? <ZipButton href={`/admin/clients/${id}/kit/photos?app=${app}`} label="Download all (zip)" /> : null}
                        <CopyButton text={text} />
                        <OpForm action={regenerateSectionAction.bind(null, id, app, section)} label="Rebuild" pendingLabel="Rebuilding…"><span /></OpForm>
                      </div>
                      {data ? <SectionBody section={section} kit={sections as KitSections} urlFor={(photoId) => urlOf.get(pathOf.get(photoId) ?? "") ?? null} tz={tz} today={today} /> : <span className={styles.muted}>Not built yet. Press Rebuild.</span>}
                    </div>
                  );
                })}
                <OpForm action={generateKitAction.bind(null, id, app)} label="Regenerate the whole kit" pendingLabel="Generating…"><span className={styles.muted}>Replaces every section with fresh data.</span></OpForm>
              </div>
            )}
          </section>
        );
      })}
      {!(accounts ?? []).length ? <section className={styles.card}><div className={styles.empty}>This client has not chosen any app.</div></section> : null}
    </main>
  );
}

function SectionBody({ section, kit, urlFor, tz, today }: { section: KitSection; kit: KitSections; urlFor: (photoId: string) => string | null; tz: string; today: string }) {
  const muted = styles.muted;
  if (section === "bio") {
    const b = kit.bio;
    return b.text ? <div><p style={{ whiteSpace: "pre-wrap" }}>{b.text}</p><p className={styles.sub} data-testid="bio-count">{b.length}/{b.limit} characters{b.clipped ? " (shortened to fit)" : ""}{b.source === "general" ? " · from the general profile" : ""}</p></div> : <span className={muted}>The starter pack has no bio yet. Write the pack first.</span>;
  }
  if (section === "prompts") {
    return kit.prompts.max === 0 ? <span className={muted}>This app has no prompts.</span> : kit.prompts.items.length ? (
      <div style={{ display: "grid", gap: 8 }}>{kit.prompts.items.map((p) => <div key={p.prompt}><strong>{p.prompt}</strong><p>{p.answer}</p><p className={styles.sub}>{p.answer.length}/{kit.prompts.limit}{p.clipped ? " (shortened to fit)" : ""}</p></div>)}</div>
    ) : <span className={muted}>No prompts in the starter pack for this app.</span>;
  }
  if (section === "photos") {
    return (
      <div>
        {kit.photos.note ? <div className={styles.notice}>{kit.photos.note}</div> : null}
        <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
          {kit.photos.items.map((p, i) => {
            const src = urlFor(p.photoId);
            return <figure key={p.photoId} style={{ margin: 0, textAlign: "center" }}>{src ? <img src={src} alt={`Photo ${i + 1}`} style={{ height: 110, borderRadius: 8 }} /> : <span className={muted}>gone</span>}<figcaption className={styles.sub}>{i + 1} · {p.role}</figcaption></figure>;
          })}
        </div>
        <p className={styles.sub}>Up to {kit.photos.max} for this app{kit.photos.skippedFlagged ? ` · ${kit.photos.skippedFlagged} flagged photo${kit.photos.skippedFlagged === 1 ? "" : "s"} left out` : ""}. Upload in this order.</p>
      </div>
    );
  }
  if (section === "filters") {
    const f = kit.filters;
    return <p>Show me <strong>{f.show ?? "not set"}</strong> · ages <strong>{f.ageMin ?? "?"} to {f.ageMax ?? "?"}</strong> · distance <strong>{f.distanceKm ?? "?"} km</strong> ({f.distanceMiles ?? "?"} mi){f.lookingFor ? ` · looking for: ${f.lookingFor}` : ""}</p>;
  }
  if (section === "tone") {
    return (
      <div style={{ display: "grid", gap: 6 }}>
        <p>{kit.tone.guide}</p>
        <strong>Openers</strong>{kit.tone.openers.map((o) => <div key={o} className={muted}>{o}</div>)}
        <strong>Replies</strong>{kit.tone.replies.map((r) => <div key={r.situation} className={muted}>{r.situation}: {r.template}</div>)}
      </div>
    );
  }
  if (section === "dealbreakers") {
    return kit.dealbreakers.items.length ? <ul>{kit.dealbreakers.items.map((d) => <li key={d}>{d}</li>)}</ul> : <span className={muted}>None listed.</span>;
  }
  const s = kit.schedule;
  return (
    <div style={{ display: "grid", gap: 4 }}>
      {s.windows.map((w) => (
        <div key={w.days}>{w.days} {w.start}-{w.end} {tz ? <span className={muted}>{tz} · {convertClock(w.start, today, tz, "UTC")}-{convertClock(w.end, today, tz, "UTC")} UTC</span> : <span className={muted}>client&rsquo;s local time (zone not set)</span>}</div>
      ))}
      {s.plan ? <p className={styles.sub}>{s.plan}{s.budget ? ` · ${s.budget}` : ""}{s.venues.length ? ` · ${s.venues.join(" / ")}` : ""}</p> : null}
    </div>
  );
}
