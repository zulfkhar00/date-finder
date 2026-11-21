import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { APPS, APP_LABELS, MODE_LABELS, STATUS_LABELS, WORKFLOW_STATUSES, chatMode, effectiveStatus, isHaltedStatus, type App, type AppStatus } from "@/lib/app/domain";
import { listEvents } from "@/lib/fulfilment/service";
import { getRunPanel } from "@/lib/activity/service";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { LocalTime } from "../../_components/local-time";
import { SetupNotice } from "../../_components/notices";
import { formatDateTime } from "../../_lib/format";
import { decideFlaggedPhotoAction, addDateAction, addMatchAction, addMessageAction, generatePackAction, addNoteAction, setAppStatusAction, setNeedsYouAction, setRunAction } from "../actions";
import { flagLabel } from "@/lib/starter-pack/photo-flags-core";
import { listFlaggedForUser, livePhotoRows } from "@/lib/starter-pack/photo-flags";
import { PACK_VERSION } from "@/lib/starter-pack/types";
import { OpForm, TzOffset } from "../op-form";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminClientPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sb = getSupabaseAdmin();
  const [{ data: pack }, { data: profile }, { data: prefs }, { data: appsNew }, { data: matches }, { data: dates }, { data: takeovers }, { data: consents }, photos, flaggedPhotos, auth] = await Promise.all([
    sb.from("starter_packs").select("status, content, attempts, last_error, tokens, model, generated_at, next_attempt_at, updated_at").eq("user_id", id).eq("version", PACK_VERSION).maybeSingle(),
    sb.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    sb.from("preferences").select("*").eq("user_id", id).maybeSingle(),
    sb.from("app_accounts").select("app, status, user_paused, client_action_reason, status_changed_at, handoff_method, login_scheduled_at, consented_at").eq("user_id", id),
    sb.from("matches").select("*").eq("user_id", id).order("matched_at", { ascending: false }),
    sb.from("dates").select("*").eq("user_id", id).order("starts_at"),
    sb.from("takeovers").select("match_id, ended_at").eq("user_id", id),
    sb.from("consents").select("version, accepted_at").eq("user_id", id).order("accepted_at", { ascending: false }).limit(1),
    livePhotoRows<{ path: string; position: number }>(sb, id, "path, position"),
    listFlaggedForUser(sb, id),
    sb.auth.admin.getUserById(id)
  ]);
  // The new columns exist after supabase/2026-11-20-fulfilment.sql; before it, read the old ones so the page still works.
  const apps: { app: string; status: AppStatus; user_paused: boolean; client_action_reason?: string | null; status_changed_at?: string | null; handoff_method?: string | null; login_scheduled_at?: string | null; consented_at?: string | null }[] | null = appsNew ?? ((await sb.from("app_accounts").select("app, status, user_paused").eq("user_id", id)).data as never);
  const log = await listEvents(sb, id);
  const run = await getRunPanel(sb, id);
  // Reply helper usage: counts only, never the chats or the drafts. Read separately so the page works before supabase/2026-11-21-reply-helper.sql is applied.
  const [replyThreads, replyRuns, replyToday] = await Promise.all([
    sb.from("reply_threads").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("reply_helper_runs").select("id", { count: "exact", head: true }).eq("user_id", id),
    sb.from("reply_helper_runs").select("id", { count: "exact", head: true }).eq("user_id", id).eq("day", new Date().toISOString().slice(0, 10))
  ]);
  const replyReady = !replyThreads.error && !replyRuns.error;
  const held = (profile?.report_hold as string | null | undefined) ?? null;
  if (!profile) notFound();
  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: msgs } = matchIds.length ? await sb.from("messages").select("id, match_id, sender, body, sent_at, delivered_at").in("match_id", matchIds).order("sent_at", { ascending: false }).limit(300) : { data: [] };
  const signedUrls = (await sb.storage.from("profile-photos").createSignedUrls([...photos.map((p) => p.path), ...flaggedPhotos.map((p) => p.path)], 600)).data ?? [];
  const urlFor = new Map(signedUrls.map((u) => [u.path, u.signedUrl]));
  const flaggedPaths = new Set(flaggedPhotos.map((p) => p.path));
  const urls = photos.filter((p) => !flaggedPaths.has(p.path)).map((p) => ({ path: p.path, signedUrl: urlFor.get(p.path) ?? null }));

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.sub}><Link href="/admin/clients" className={styles.rowLink}>← Clients</Link></p>
          <h1>{profile.first_name || "Unnamed"} {profile.internal ? <span className={styles.badge}>internal</span> : null}</h1>
          <p className={styles.sub}>{auth.data.user?.email} · {profile.city ?? "no city"} · {profile.job ?? "no job"} · consent {consents?.[0] ? formatDateTime(consents[0].accepted_at) : "not given"}</p>
        </div>
      </div>

      {flaggedPhotos.length ? (
        <section className={styles.card} aria-label="Flagged photos" data-testid="flagged-photos">
          <h2 className={styles.subhead}>Flagged photos <span className={styles.badge} data-tone="warn">{flaggedPhotos.length}</span></h2>
          <p className={styles.sub}>The model held these back for a person to look at. They are not used in the pack. The user only sees &ldquo;One photo can&rsquo;t be used&rdquo;. Approve if it was a false positive, or remove it.</p>
          <div style={{ display: "grid", gap: 14 }}>
            {flaggedPhotos.map((f) => (
              <div key={f.photoId} style={{ display: "grid", gap: 10, borderTop: "1px solid var(--a-line)", paddingTop: 12 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                  {urlFor.get(f.path) ? <img src={urlFor.get(f.path) ?? undefined} alt="Flagged photo" style={{ height: 160, maxWidth: "100%", borderRadius: 8 }} /> : <span className={styles.muted}>Photo unavailable</span>}
                  <div><strong>{flagLabel(f.flags)}</strong>{f.flaggedAt ? <p className={styles.sub}>Flagged {formatDateTime(f.flaggedAt)}</p> : null}</div>
                </div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <OpForm action={decideFlaggedPhotoAction.bind(null, id, "approve")} label="Approve" pendingLabel="Approving…"><input type="hidden" name="photoId" value={f.photoId} /></OpForm>
                  <OpForm action={decideFlaggedPhotoAction.bind(null, id, "remove")} label="Remove" pendingLabel="Removing…"><input type="hidden" name="photoId" value={f.photoId} /></OpForm>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {urls.length ? <section className={styles.card}><div style={{ display: "flex", gap: 8, overflowX: "auto" }}>{urls.map((u) => <img key={u.path} src={u.signedUrl ?? undefined} alt="" style={{ height: 120, borderRadius: 8 }} />)}</div></section> : null}

      <section className={styles.card}>
        <h2 className={styles.subhead}>Starter pack</h2>
        <p className={styles.sub}>
          {pack ? <><span className={styles.badge}>{pack.status}</span> · tries {pack.attempts} · {pack.tokens} tokens · {pack.model ?? "no model yet"}{pack.generated_at ? ` · written ${formatDateTime(pack.generated_at)}` : ""}{pack.last_error ? ` · last error: ${pack.last_error}` : ""}{pack.next_attempt_at && pack.status === "pending" ? ` · next try ${formatDateTime(pack.next_attempt_at)}` : ""}</> : <span className={styles.muted}>No pack yet. The 10-minute sweep creates it, or start it here.</span>}
        </p>
        <PackPreview content={pack?.content} />
        <OpForm action={generatePackAction.bind(null, id)} label={pack ? "Write the pack again" : "Write the pack now"}><span className={styles.muted}>Uses the daily pack budget. Reload the page after a minute.</span></OpForm>
      </section>

      <section className={styles.card} data-testid="reply-usage">
        <h2 className={styles.subhead}>Reply helper</h2>
        <p className={styles.sub}>
          {replyReady ? <><strong>{replyThreads.count ?? 0}</strong> reply session{(replyThreads.count ?? 0) === 1 ? "" : "s"} saved · {replyRuns.count ?? 0} model run{(replyRuns.count ?? 0) === 1 ? "" : "s"} in total · {replyToday.count ?? 0} today. Counts only: the chats and drafts are the user&rsquo;s and are not shown here.</> : <span className={styles.muted}>Not enabled yet (run supabase/2026-11-21-reply-helper.sql).</span>}
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>Who they want</h2>
        <p className={styles.sub}>
          {profile.gender ?? "?"} → {(profile.interested_in ?? []).join(", ") || "?"} · ages {prefs?.age_min ?? "?"}–{prefs?.age_max ?? "?"} · {prefs?.distance_km ?? "?"} km · {prefs?.looking_for ?? "?"} · interests: {(profile.interests ?? []).join(", ") || "?"} · dealbreakers: {(prefs?.dealbreakers ?? []).join(", ") || "?"} · tone: {profile.voice}
        </p>
      </section>

      <section className={styles.card} data-testid="app-workflow">
        <h2 className={styles.subhead}>App accounts</h2>
        <p className={styles.sub}>Waiting for login, then Setting up, then Running (Active), Paused or Closed; Needs client action whenever the client has to do something (they read your reason on their Home screen). Every change is logged with your email and the time. A report hold overrides all of this until it is lifted.</p>
        {held ? <div className={styles.notice}>A report put this account on hold ({held}). The client sees the hold, not the status below.</div> : null}
        {APPS.map((app) => {
          const row = (apps ?? []).find((a) => a.app === app);
          const current = row?.status === "live" ? "active" : row?.status ?? "awaiting_login";
          return (
            <div key={app} style={{ borderTop: "1px solid var(--a-line)", padding: "12px 0" }}>
              <strong>{APP_LABELS[app]}</strong> {row ? <span className={styles.badge}>{row.user_paused ? "paused by user" : STATUS_LABELS[row.status]}</span> : <span className={styles.muted}>not chosen by the user</span>}
              {row?.status === "needs_client_action" && row.client_action_reason ? <p className={styles.sub}>Client sees: {row.client_action_reason}</p> : null}
              {row?.status_changed_at ? <p className={styles.sub}>Changed <LocalTime iso={row.status_changed_at} /></p> : null}
              <OpForm action={setAppStatusAction.bind(null, id)} label="Save status" pendingLabel="Saving…">
                <input type="hidden" name="app" value={app} />
                <div className={styles.filters}>
                  <label className={styles.field}>Status
                    <select className={styles.select} name="status" defaultValue={current}>
                      {WORKFLOW_STATUSES.map((st) => <option key={st} value={st}>{st === "paused" ? "Paused (team)" : STATUS_LABELS[st]}</option>)}
                    </select></label>
                  <label className={styles.field} style={{ flex: "2 1 220px" }}>Reason the client sees (needed for Needs you)
                    <input className={styles.input} name="reason" maxLength={200} defaultValue={row?.status === "needs_client_action" ? row.client_action_reason ?? "" : ""} placeholder="Add 2 more photos / Log in on a fresh browser profile" /></label>
                </div>
                <label className={styles.field}>Operator note (internal, never shown to the client)
                  <input className={styles.input} name="note" maxLength={2000} /></label>
              </OpForm>
            </div>
          );
        })}
      </section>

      <section className={styles.card} data-testid="run-panel">
        <h2 className={styles.subhead}>Run</h2>
        <p className={styles.sub}>Which phone and which internal account label run each app, when the client&rsquo;s one-time login is, and what the phone reported in the last 7 days. The client sees the login time and the activity counts, never the phone or the label. Set the state above (Waiting for login, Setting up, Running, Paused, Needs you).</p>
        {run.setupNeeded ? <div className={styles.notice}>The Run panel is not set up yet. Apply <code>supabase/2026-11-21-account-runs.sql</code>.</div> : null}
        {APPS.map((app) => {
          const row = (apps ?? []).find((a) => a.app === app);
          if (!row) return null;
          const asg = run.assignments[app];
          const t = run.totals[app];
          const handoff = (row as { handoff_method?: string | null }).handoff_method;
          const loginAt = (row as { login_scheduled_at?: string | null }).login_scheduled_at;
          const consentedAt = (row as { consented_at?: string | null }).consented_at;
          return (
            <div key={app} style={{ borderTop: "1px solid var(--a-line)", padding: "12px 0", display: "grid", gap: 8 }} data-testid={`run-${app}`}>
              <div><strong>{APP_LABELS[app]}</strong> <span className={styles.badge}>{row.user_paused ? "paused by user" : STATUS_LABELS[row.status]}</span> {asg?.phoneId ? <span className={styles.badge}>{asg.phoneId}</span> : <span className={styles.muted}>no phone assigned</span>}</div>
              <p className={styles.sub}>
                Handoff: {handoff === "invite" ? "invite" : handoff === "operator_session" ? "login on our phone" : "not recorded"} · consent {consentedAt ? <>given <LocalTime iso={consentedAt} /></> : "not recorded for this app"}{loginAt ? <> · login <LocalTime iso={loginAt} /></> : " · no login scheduled"}
              </p>
              <p className={styles.sub}>
                {t ? <>7 days: {t.swipes} swipes · {t.matches} matches · {t.chats} chat events · {t.dates} dates{t.lastAt ? <> · last report <LocalTime iso={t.lastAt} /></> : null}</> : "Nothing reported by the phone yet."}
              </p>
              <OpForm action={setRunAction.bind(null, id)} label="Save run" pendingLabel="Saving…">
                <TzOffset />
                <input type="hidden" name="app" value={app} />
                <div className={styles.filters}>
                  <label className={styles.field}>Phone id<input className={styles.input} name="phoneId" maxLength={80} defaultValue={asg?.phoneId ?? ""} placeholder="pi-rack-1-phone-3" /></label>
                  <label className={styles.field}>Account label (internal)<input className={styles.input} name="accountRef" maxLength={120} defaultValue={asg?.accountRef ?? ""} placeholder="hinge-017" /></label>
                  <label className={styles.field}>Login time (your time, empty keeps it)<input className={styles.input} type="datetime-local" name="loginAt" /></label>
                  <label className={styles.field} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" name="clearLogin" value="1" /> Clear login time</label>
                </div>
              </OpForm>
            </div>
          );
        })}
        {run.recent.length ? (
          <ul className={styles.logList} style={{ marginTop: 10 }} data-testid="run-recent">
            {run.recent.map((e, i) => <li key={i}><span className={styles.muted}><LocalTime iso={e.occurred_at} /> · {APP_LABELS[e.app]}</span><br />{e.kind === "swipes" ? `${e.count} swipes` : e.kind === "match" ? "new match" : e.kind === "chat" ? "chat worked" : e.kind === "date_booked" ? "date booked" : `needs you${e.reason ? `: ${e.reason}` : ""}`}</li>)}
          </ul>
        ) : null}
      </section>

      <section className={styles.card} data-testid="fulfilment-log">
        <h2 className={styles.subhead}>Notes and status log</h2>
        {log.setupNeeded ? <div className={styles.notice}>The log is not set up yet. Apply <code>supabase/2026-11-20-fulfilment.sql</code>.</div> : null}
        <OpForm action={addNoteAction.bind(null, id)} label="Add note" pendingLabel="Saving…">
          <label className={styles.field}>Internal note<textarea className={styles.textarea} style={{ minHeight: 80 }} name="note" required maxLength={2000} /></label>
        </OpForm>
        {log.events.length ? (
          <ul className={styles.logList} style={{ marginTop: 14 }}>
            {log.events.map((e) => (
              <li key={e.id}>
                <span className={styles.muted}><LocalTime iso={e.at} /> · {e.actor}{e.app ? ` · ${APP_LABELS[e.app as App] ?? e.app}` : ""}</span><br />
                {e.action === "status" ? <>{(e.from_status ?? "none").replace(/_/g, " ")} → <strong>{(e.to_status ?? "").replace(/_/g, " ")}</strong>{e.reason ? <> · client sees &ldquo;{e.reason}&rdquo;</> : null}{e.note ? <> · {e.note}</> : null}</> : <>{e.note}</>}
              </li>
            ))}
          </ul>
        ) : <p className={styles.muted} style={{ marginTop: 10 }}>Nothing logged yet.</p>}
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>Add a match</h2>
        <OpForm action={addMatchAction.bind(null, id)} label="Add match" encType="multipart/form-data">
          <div className={styles.filters}>
            <label className={styles.field}>App<select className={styles.select} name="app">{APPS.map((a) => <option key={a} value={a}>{APP_LABELS[a]}</option>)}</select></label>
            <label className={styles.field}>Name<input className={styles.input} name="name" required maxLength={80} /></label>
            <label className={styles.field}>Age<input className={styles.input} name="age" inputMode="numeric" maxLength={2} /></label>
            <label className={styles.field}>Photo (optional)<input className={styles.input} type="file" name="photo" accept="image/jpeg,image/png,image/webp" /></label>
          </div>
        </OpForm>
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>Chats ({matches?.length ?? 0})</h2>
        {!matches?.length ? <div className={styles.empty}>No matches yet. Add one above.</div> : matches.map((m) => {
          const mode = chatMode((takeovers ?? []).filter((t) => t.match_id === m.id));
          const acct = (apps ?? []).find((a) => a.app === m.app);
          const paused = acct ? isHaltedStatus(effectiveStatus(acct)) : false;
          const thread = (msgs ?? []).filter((x) => x.match_id === m.id && x.sender !== "system_internal").slice(0, 6).reverse();
          return (
            <div key={m.id} style={{ borderTop: "1px solid var(--a-line)", padding: "14px 0", display: "grid", gap: 10 }}>
              <div><strong>{m.name}{m.age ? `, ${m.age}` : ""}</strong> <span className={styles.badge}>{APP_LABELS[m.app as App]}</span> <span className={styles.badge}>{MODE_LABELS[mode]}</span> {m.needs_user ? <span className={styles.badge}>needs user</span> : null}</div>
              {mode === "user" ? <div className={styles.notice}>The user has taken over this chat. AI-side sends are blocked until they hand it back.</div> : paused ? <div className={styles.notice}>The user paused {APP_LABELS[m.app as App]}. AI-side sends are blocked.</div> : null}
              <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
                {thread.length ? thread.map((x) => <div key={x.id}><span className={styles.muted}>{x.sender === "match" ? m.name : x.sender === "user" ? "user (typed)" : "as user (NoSwipe)"}{x.sender === "user" && !x.delivered_at ? " · not sent in app yet" : ""}:</span> {x.body}</div>) : <span className={styles.muted}>No messages.</span>}
              </div>
              <OpForm action={addMessageAction.bind(null, id, m.id)} label="Add message">
                <div className={styles.filters}>
                  <label className={styles.field}>Sender<select className={styles.select} name="sender"><option value="match">From {m.name}</option><option value="as_user_ai" disabled={mode === "user" || paused}>As the user (NoSwipe)</option></select></label>
                  <label className={styles.field} style={{ flex: 1 }}>Message<input className={styles.input} name="body" required maxLength={4000} /></label>
                </div>
              </OpForm>
              <OpForm action={setNeedsYouAction.bind(null, id, m.id)} label={m.needs_user ? "Clear" : "Flag: needs the user"}>
                <input type="hidden" name="needs" value={m.needs_user ? "0" : "1"} />
                {!m.needs_user ? <label className={styles.field}>Reason (shown to the user)<input className={styles.input} name="reason" maxLength={200} placeholder="She asked to move to WhatsApp" /></label> : null}
              </OpForm>
            </div>
          );
        })}
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>Dates ({dates?.length ?? 0})</h2>
        {(dates ?? []).map((d) => <div key={d.id} style={{ fontSize: 13 }}>{formatDateTime(d.starts_at)} · {d.who} · {d.venue} {d.status === "cancelled" ? "(cancelled)" : ""}</div>)}
        <h3 className={styles.subhead} style={{ marginTop: 14 }}>Book a date</h3>
        <OpForm action={addDateAction.bind(null, id)} label="Book date">
          <TzOffset />
          <div className={styles.filters}>
            <label className={styles.field}>Chat<select className={styles.select} name="matchId"><option value="">None</option>{(matches ?? []).map((m) => <option key={m.id} value={m.id}>{m.name} · {APP_LABELS[m.app as App]}</option>)}</select></label>
            <label className={styles.field}>Who<input className={styles.input} name="who" required maxLength={80} /></label>
            <label className={styles.field}>Venue<input className={styles.input} name="venue" required maxLength={160} /></label>
            <label className={styles.field}>Address<input className={styles.input} name="address" maxLength={240} /></label>
            <label className={styles.field}>When (your time)<input className={styles.input} type="datetime-local" name="startsAt" required /></label>
          </div>
          <label className={styles.field}>What they talked about<textarea className={styles.textarea} name="summary" maxLength={600} /></label>
        </OpForm>
      </section>
    </main>
  );
}

type PackJson = { profiles?: { app: string; prompts?: { prompt: string; answer: string }[]; bio: string }[]; openers?: { line: string }[]; replies?: { situation: string; template: string }[]; datePlan?: { headline: string; venues: { type: string }[]; when: string; budget: string } } | null;

function PackPreview({ content }: { content: unknown }) {
  const c = content as PackJson;
  if (!c || typeof c !== "object") return null;
  return (
    <div style={{ fontSize: 13, display: "grid", gap: 8, margin: "10px 0" }}>
      {(c.profiles ?? []).map((p) => (
        <div key={p.app}><strong>{p.app}</strong>: {p.bio}{(p.prompts ?? []).map((q) => <div key={q.prompt} className={styles.muted}>{q.prompt}: {q.answer}</div>)}</div>
      ))}
      <div><strong>Openers</strong>{(c.openers ?? []).map((o) => <div key={o.line} className={styles.muted}>{o.line}</div>)}</div>
      <div><strong>Replies</strong>{(c.replies ?? []).map((r) => <div key={r.situation} className={styles.muted}>{r.situation}: {r.template}</div>)}</div>
      {c.datePlan ? <div><strong>Date</strong> <span className={styles.muted}>{c.datePlan.headline} · {c.datePlan.venues.map((v) => v.type).join(" / ")} · {c.datePlan.when} · {c.datePlan.budget}</span></div> : null}
    </div>
  );
}
