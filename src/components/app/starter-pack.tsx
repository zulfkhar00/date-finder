import Link from "next/link";
import { USER_FLAG_NOTICE } from "@/lib/starter-pack/photo-flags-core";
import { CalendarClock, Camera, ChevronRight, MessageCircle, PenLine } from "lucide-react";
import { CopyButton, PackPoller, RegenerateButton } from "@/components/app/starter-pack-client";
import type { StarterPackView } from "@/lib/app/data";
import type { AppAccountRow } from "@/lib/app/domain";
import type { PackApp, PackContent } from "@/lib/starter-pack/types";

// "The profile we set up for you" on Home: the text, photo order, openers and date plan NoSwipe runs your accounts with.
// It is the engine, not a to-do list: the client can read and tweak it, and copy a line if they want to use it themselves.

const APP_TITLE: Record<PackApp, string> = { hinge: "Hinge", tinder: "Tinder", bumble: "Bumble", general: "Any app" };

/** The status of each app is on the Home cards above; this line only frames the pack and promises nothing about the setup. */
export function SetupStatus({ apps }: { apps: AppAccountRow[] }) {
  const waiting = apps.some((a) => (a.status === "setting_up" || a.status === "awaiting_login") && !a.user_paused);
  if (!waiting) return null;
  return null;
}

function Skeleton() {
  return (
    <div className="sp-skels" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="app-card sp-skel"><i style={{ width: "42%" }} /><i /><i style={{ width: "86%" }} /><i style={{ width: "64%" }} /></div>)}
    </div>
  );
}

function Line({ text, label }: { text: string; label?: string }) {
  return (
    <div className="sp-line">
      <p>{text}</p>
      <CopyButton text={text} label={label} />
    </div>
  );
}

function Profiles({ content }: { content: PackContent }) {
  return (
    <>
      {content.profiles.map((p) => (
        <details key={p.app} className="app-card sp-card" aria-label={`Your ${APP_TITLE[p.app]} profile`} open>
          <summary className="sp-head"><PenLine size={18} aria-hidden /><h3>Your {APP_TITLE[p.app]} profile</h3></summary>
          {p.prompts?.map((q) => (
            <div key={q.prompt} className="sp-prompt">
              <strong>{q.prompt}</strong>
              <Line text={q.answer} />
            </div>
          ))}
          <div className="sp-prompt">
            <strong>{p.app === "hinge" ? "Short intro line" : "Bio"}</strong>
            <Line text={p.bio} />
          </div>
        </details>
      ))}
    </>
  );
}

const ROLE_LABEL = { lead: "Show first", keep: "Keep", drop: "Drop" } as const;

function Photos({ content, photoUrls, flagged }: { content: PackContent; photoUrls: Record<string, string | null>; flagged: boolean }) {
  const photos = content.photos;
  return (
    <details className="app-card sp-card" aria-label="Photos">
      <summary className="sp-head"><Camera size={18} aria-hidden /><h3>{photos.kind === "ranked" ? "Your photo order" : "Photos to take"}</h3></summary>
      {flagged ? <p className="app-error sp-how" role="status" data-testid="photo-flag-notice">{USER_FLAG_NOTICE}</p> : null}
      {photos.kind === "ranked" ? (
        <>
          <ol className="sp-photos">
            {photos.order.filter((o) => photoUrls[o.photo_id] !== undefined).map((o, i) => (
              <li key={o.photo_id} data-role={o.role}>
                <div className="sp-thumb">
                  {photoUrls[o.photo_id] ? <img src={photoUrls[o.photo_id] ?? undefined} alt={`Your photo, suggested spot ${i + 1}`} loading="lazy" /> : <span className="app-muted">Photo unavailable</span>}
                  <b>{i + 1}</b>
                </div>
                <div>
                  <span className="app-pill" data-tone={o.role === "lead" ? "lime" : o.role === "drop" ? "grey" : undefined}><i />{ROLE_LABEL[o.role]}</span>
                  <p>{o.reason}</p>
                </div>
              </li>
            ))}
          </ol>
          {photos.add.length ? <div className="sp-add"><strong>Add if you can</strong><ul>{photos.add.map((a) => <li key={a}>{a}</li>)}</ul></div> : null}
        </>
      ) : (
        <ul className="sp-list">{photos.items.map((t) => <li key={t}>{t}</li>)}</ul>
      )}
    </details>
  );
}

function DatePlan({ content }: { content: PackContent }) {
  const d = content.datePlan;
  return (
    <details className="app-card sp-card" aria-label="Your first date">
      <summary className="sp-head"><CalendarClock size={18} aria-hidden /><h3>Your first date</h3></summary>
      <p className="sp-date-title">{d.headline}</p>
      <dl className="sp-dl">
        {d.venues.map((v, i) => <div key={v.type}><dt>Option {i + 1}</dt><dd><strong>{v.type}</strong><span>{v.why}</span></dd></div>)}
        <div><dt>When</dt><dd>{d.when}</dd></div>
        <div><dt>Budget</dt><dd>{d.budget}</dd></div>
        <div><dt>Backup</dt><dd>{d.backup}</dd></div>
        {d.tip ? <div><dt>Tip</dt><dd>{d.tip}</dd></div> : null}
      </dl>
    </details>
  );
}

export function StarterPack({ pack, apps, photoUrls, hasCity, regenLeft, photoFlagged = false }: {
  pack: StarterPackView | null; apps: AppAccountRow[]; photoUrls: Record<string, string | null>; hasCity: boolean; regenLeft: number; photoFlagged?: boolean;
}) {
  const content = pack?.status === "ready" ? pack.content : null;
  const failed = pack?.status === "failed";
  return (
    <section aria-label="The profile we set up for you" className="sp" data-state={content ? "ready" : failed ? "failed" : "preparing"}>
      <SetupStatus apps={apps} />
      <h2 className="app-h2">Your profile</h2>
      {!content && !failed ? (
        <>
          <div className="app-card sp-wait" role="status">
            <span className="app-spinner" aria-hidden />
            <div><strong>Writing your profile…</strong><p className="app-muted">Usually takes a minute.</p></div>
          </div>
          <Skeleton />
          <PackPoller />
        </>
      ) : null}
      {failed ? (
        <div className="app-card sp-wait" role="status">
          <MessageCircle size={20} aria-hidden />
          <div><strong>Your pack isn&rsquo;t ready yet</strong><p className="app-muted">We&rsquo;ll retry automatically.</p><RegenerateButton left={regenLeft} label="Try again" /></div>
        </div>
      ) : null}
      {content ? (
        <>
          <div className="sp-stack">
            <Profiles content={content} />
            <Photos content={content} photoUrls={photoUrls} flagged={photoFlagged} />
            <details className="app-card sp-card" aria-label="Opening lines">
              <summary className="sp-head"><MessageCircle size={18} aria-hidden /><h3>Our opening lines for you</h3></summary>
              <ol className="sp-items">{content.openers.map((o) => <li key={o.line}><Line text={o.line} /></li>)}</ol>
            </details>
            <details className="app-card sp-card" aria-label="Reply templates">
              <summary className="sp-head"><MessageCircle size={18} aria-hidden /><h3>How we&rsquo;ll reply</h3></summary>
              <ol className="sp-items">{content.replies.map((r) => <li key={r.situation}><strong>{r.situation}</strong><Line text={r.template} /></li>)}</ol>
              <Link href="/chats/reply" className="app-link" data-testid="pack-reply-helper-link">Try the reply helper<ChevronRight size={16} aria-hidden /></Link>
            </details>
            <DatePlan content={content} />
          </div>
          {!hasCity ? <p className="app-muted sp-note">Add your city in <Link href="/profile" className="app-link">Profile</Link> for a local date plan.</p> : null}
          <RegenerateButton left={regenLeft} />
        </>
      ) : null}
    </section>
  );
}
