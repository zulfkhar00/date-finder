import Link from "next/link";
import { CalendarClock, Camera, MessageCircle, PenLine, Sparkles } from "lucide-react";
import { CopyButton, PackPoller, RegenerateButton } from "@/components/app/starter-pack-client";
import type { StarterPackView } from "@/lib/app/data";
import { APP_LABELS, type App, type AppAccountRow } from "@/lib/app/domain";
import type { PackApp, PackContent } from "@/lib/starter-pack/types";

// "Your starter pack" on Home. Everything here is text the user pastes into their own dating apps; NoSwipe does
// not log in to or act inside any of them, and the copy says so plainly.

const HOW_TO: Record<PackApp, string> = {
  hinge: "Open Hinge, tap Edit on your profile, tap a prompt, pick the same title, and paste the answer.",
  tinder: "Open Tinder, tap Edit info, and paste this into About me.",
  bumble: "Open Bumble, tap Edit, and paste this into About me.",
  general: "Paste this into the bio of any dating app."
};
const APP_TITLE: Record<PackApp, string> = { hinge: "Hinge", tinder: "Tinder", bumble: "Bumble", general: "Any app" };

export function SetupStatus({ apps }: { apps: AppAccountRow[] }) {
  const settingUp = apps.filter((a) => a.status === "setting_up" && !a.user_paused).map((a) => APP_LABELS[a.app as App]);
  if (!settingUp.length) return null;
  const names = settingUp.length > 1 ? `${settingUp.slice(0, -1).join(", ")} and ${settingUp[settingUp.length - 1]}` : settingUp[0];
  return <p className="app-sub sp-lede">We&rsquo;re setting up your {names}. In the meantime, here&rsquo;s your starter pack: written for you, ready to use today.</p>;
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
        <section key={p.app} className="app-card sp-card" aria-label={`Use this on ${APP_TITLE[p.app]}`}>
          <div className="sp-head"><PenLine size={18} aria-hidden /><h3>Use this on {APP_TITLE[p.app]}</h3></div>
          <p className="app-muted sp-how">{HOW_TO[p.app]}</p>
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
        </section>
      ))}
    </>
  );
}

const ROLE_LABEL = { lead: "Show first", keep: "Keep", drop: "Drop" } as const;

function Photos({ content, photoUrls }: { content: PackContent; photoUrls: Record<string, string | null> }) {
  const photos = content.photos;
  return (
    <section className="app-card sp-card" aria-label="Photos">
      <div className="sp-head"><Camera size={18} aria-hidden /><h3>{photos.kind === "ranked" ? "Your photo order" : "Photos to take"}</h3></div>
      {photos.note ? <p className="app-muted sp-how">{photos.note}</p> : null}
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
    </section>
  );
}

function DatePlan({ content }: { content: PackContent }) {
  const d = content.datePlan;
  return (
    <section className="app-card sp-card" aria-label="Your first date">
      <div className="sp-head"><CalendarClock size={18} aria-hidden /><h3>Your first date</h3></div>
      <p className="sp-date-title">{d.headline}</p>
      <dl className="sp-dl">
        {d.venues.map((v, i) => <div key={v.type}><dt>Option {i + 1}</dt><dd><strong>{v.type}</strong><span>{v.why}</span></dd></div>)}
        <div><dt>When</dt><dd>{d.when}</dd></div>
        <div><dt>Budget</dt><dd>{d.budget}</dd></div>
        <div><dt>Backup</dt><dd>{d.backup}</dd></div>
        {d.tip ? <div><dt>Tip</dt><dd>{d.tip}</dd></div> : null}
      </dl>
    </section>
  );
}

export function StarterPack({ pack, apps, photoUrls, hasCity, regenLeft }: {
  pack: StarterPackView | null; apps: AppAccountRow[]; photoUrls: Record<string, string | null>; hasCity: boolean; regenLeft: number;
}) {
  const content = pack?.status === "ready" ? pack.content : null;
  const failed = pack?.status === "failed";
  return (
    <section aria-label="Your starter pack" className="sp" data-state={content ? "ready" : failed ? "failed" : "preparing"}>
      <SetupStatus apps={apps} />
      <div className="sp-title"><Sparkles size={20} aria-hidden /><h2 className="app-h2">Your starter pack</h2></div>
      {!content && !failed ? (
        <>
          <div className="app-card sp-wait" role="status">
            <span className="app-spinner" aria-hidden />
            <div><strong>We&rsquo;re writing your pack</strong><p className="app-muted">Your profile text, photo order, openers and a first-date plan. It usually takes a minute. If it isn&rsquo;t here yet, it will be on your next visit.</p></div>
          </div>
          <Skeleton />
          <PackPoller />
        </>
      ) : null}
      {failed ? (
        <div className="app-card sp-wait" role="status">
          <MessageCircle size={20} aria-hidden />
          <div><strong>Your pack isn&rsquo;t ready yet</strong><p className="app-muted">Something went wrong on our side. We try again automatically, or you can start it now.</p><RegenerateButton left={regenLeft} label="Try again" /></div>
        </div>
      ) : null}
      {content ? (
        <>
          <p className="app-sub">Written in your voice from your answers. Copy a line, paste it into the app yourself. You send everything, and NoSwipe never logs in to your dating apps.</p>
          <div className="sp-stack">
            <Profiles content={content} />
            <Photos content={content} photoUrls={photoUrls} />
            <section className="app-card sp-card" aria-label="Opening lines">
              <div className="sp-head"><MessageCircle size={18} aria-hidden /><h3>5 opening lines</h3></div>
              <p className="app-muted sp-how">Send one when you match. Change a word or two so it sounds like you that day.</p>
              <ol className="sp-items">{content.openers.map((o) => <li key={o.line}><Line text={o.line} /><span className="app-muted">{o.why}</span></li>)}</ol>
            </section>
            <section className="app-card sp-card" aria-label="Reply templates">
              <div className="sp-head"><MessageCircle size={18} aria-hidden /><h3>3 replies for common moments</h3></div>
              <ol className="sp-items">{content.replies.map((r) => <li key={r.situation}><strong>{r.situation}</strong><Line text={r.template} /></li>)}</ol>
            </section>
            <DatePlan content={content} />
          </div>
          {!hasCity ? <p className="app-muted sp-note">Add your city in <Link href="/profile" className="app-link">Profile</Link> and write it again for a plan that fits where you live.</p> : null}
          <RegenerateButton left={regenLeft} />
        </>
      ) : null}
    </section>
  );
}
