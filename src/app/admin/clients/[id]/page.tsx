import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-auth";
import { APPS, APP_LABELS, MODE_LABELS, chatMode, effectiveStatus, type App } from "@/lib/app/domain";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { SetupNotice } from "../../_components/notices";
import { formatDateTime } from "../../_lib/format";
import { addDateAction, addMatchAction, addMessageAction, generatePackAction, setAppStatusAction, setNeedsYouAction } from "../actions";
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
  const [{ data: pack }, { data: profile }, { data: prefs }, { data: apps }, { data: matches }, { data: dates }, { data: takeovers }, { data: consents }, { data: photos }, auth] = await Promise.all([
    sb.from("starter_packs").select("status, content, attempts, last_error, tokens, model, generated_at, next_attempt_at, updated_at").eq("user_id", id).eq("version", PACK_VERSION).maybeSingle(),
    sb.from("profiles").select("*").eq("user_id", id).maybeSingle(),
    sb.from("preferences").select("*").eq("user_id", id).maybeSingle(),
    sb.from("app_accounts").select("app, status, user_paused").eq("user_id", id),
    sb.from("matches").select("*").eq("user_id", id).order("matched_at", { ascending: false }),
    sb.from("dates").select("*").eq("user_id", id).order("starts_at"),
    sb.from("takeovers").select("match_id, ended_at").eq("user_id", id),
    sb.from("consents").select("version, accepted_at").eq("user_id", id).order("accepted_at", { ascending: false }).limit(1),
    sb.from("profile_photos").select("path, position").eq("user_id", id).order("position"),
    sb.auth.admin.getUserById(id)
  ]);
  if (!profile) notFound();
  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: msgs } = matchIds.length ? await sb.from("messages").select("id, match_id, sender, body, sent_at, delivered_at").in("match_id", matchIds).order("sent_at", { ascending: false }).limit(300) : { data: [] };
  const urls = photos?.length ? (await sb.storage.from("profile-photos").createSignedUrls(photos.map((p) => p.path), 600)).data ?? [] : [];

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <p className={styles.sub}><Link href="/admin/clients" className={styles.rowLink}>← Clients</Link></p>
          <h1>{profile.first_name || "Unnamed"} {profile.internal ? <span className={styles.badge}>internal</span> : null}</h1>
          <p className={styles.sub}>{auth.data.user?.email} · {profile.city ?? "no city"} · {profile.job ?? "no job"} · consent {consents?.[0] ? formatDateTime(consents[0].accepted_at) : "not given"}</p>
        </div>
      </div>

      {urls.length ? <section className={styles.card}><div style={{ display: "flex", gap: 8, overflowX: "auto" }}>{urls.map((u) => <img key={u.path} src={u.signedUrl ?? undefined} alt="" style={{ height: 120, borderRadius: 8 }} />)}</div></section> : null}

      <section className={styles.card}>
        <h2 className={styles.subhead}>Starter pack</h2>
        <p className={styles.sub}>
          {pack ? <><span className={styles.badge}>{pack.status}</span> · tries {pack.attempts} · {pack.tokens} tokens · {pack.model ?? "no model yet"}{pack.generated_at ? ` · written ${formatDateTime(pack.generated_at)}` : ""}{pack.last_error ? ` · last error: ${pack.last_error}` : ""}{pack.next_attempt_at && pack.status === "pending" ? ` · next try ${formatDateTime(pack.next_attempt_at)}` : ""}</> : <span className={styles.muted}>No pack yet. The 10-minute sweep creates it, or start it here.</span>}
        </p>
        <PackPreview content={pack?.content} />
        <OpForm action={generatePackAction.bind(null, id)} label={pack ? "Write the pack again" : "Write the pack now"}><span className={styles.muted}>Uses the daily pack budget. Reload the page after a minute.</span></OpForm>
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>Who they want</h2>
        <p className={styles.sub}>
          {profile.gender ?? "?"} → {(profile.interested_in ?? []).join(", ") || "?"} · ages {prefs?.age_min ?? "?"}–{prefs?.age_max ?? "?"} · {prefs?.distance_km ?? "?"} km · {prefs?.looking_for ?? "?"} · interests: {(profile.interests ?? []).join(", ") || "?"} · dealbreakers: {(prefs?.dealbreakers ?? []).join(", ") || "?"} · tone: {profile.voice}
        </p>
      </section>

      <section className={styles.card}>
        <h2 className={styles.subhead}>App accounts</h2>
        {APPS.map((app) => {
          const row = (apps ?? []).find((a) => a.app === app);
          return (
            <div key={app} style={{ borderTop: "1px solid var(--a-line)", padding: "12px 0" }}>
              <strong>{APP_LABELS[app]}</strong> {row ? <span className={styles.badge}>{row.user_paused ? "paused by user" : row.status}</span> : <span className={styles.muted}>not chosen by the user</span>}
              <OpForm action={setAppStatusAction.bind(null, id)} label="Set status">
                <input type="hidden" name="app" value={app} />
                <label className={styles.field}>Status
                  <select className={styles.select} name="status" defaultValue={row?.status ?? "setting_up"}>
                    <option value="setting_up">Setting up</option><option value="live">Live</option><option value="paused">Paused (team)</option>
                  </select></label>
              </OpForm>
            </div>
          );
        })}
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
          const paused = acct ? effectiveStatus(acct) === "paused" : false;
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
