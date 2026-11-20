import Link from "next/link";
import type { ComponentProps } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, Sparkles, User } from "lucide-react";
import { AppBadge, Avatar, Empty, ModePill, RowLink } from "@/components/app/ui";
import { IcsButton } from "@/components/app/ics-button";
import { When } from "@/components/app/when";
import { StarterPack } from "@/components/app/starter-pack";
import type { ChatSummary, SetupItem } from "@/lib/app/data";
import { APP_LABELS, APPS, splitDates, type AppAccountRow, type DateRow } from "@/lib/app/domain";
import { appCopy, type CopyContext } from "@/lib/app/status-copy";

// Presentational screens. The real pages (server components, real data) and /demo (sample data) both render
// these, so the two are the same pixels. `base` is "" for the app and "/demo" for the demo.

/** Shown while there is nothing to read yet: says what is happening and what the user can do now. */
export function NextSteps({ apps, gaps, compact }: { apps: AppAccountRow[]; gaps: SetupItem[]; compact?: boolean }) {
  const names = APPS.filter((a) => apps.some((x) => x.app === a)).map((a) => APP_LABELS[a]).join(", ");
  return (
    <section className="app-card app-next" aria-label="What happens next">
      {compact ? null : <h2 style={{ fontSize: 17, fontWeight: 800 }}>What happens next</h2>}
      <ol className="app-steps">
        <li><span aria-hidden>1</span><div><strong>A person on our team sets up your profile</strong><p>{names ? `On ${names}, from your photos and answers.` : "On the apps you pick, from your photos and answers."}</p></div></li>
        <li><span aria-hidden>2</span><div><strong>Matches and chats appear here</strong><p>Once your apps are running, read along any time, or take over a chat.</p></div></li>
        <li><span aria-hidden>3</span><div><strong>Dates land in Dates</strong><p>With the place and the time, plus an email if you have those on.</p></div></li>
      </ol>
      {gaps.length ? (
        <div className="app-next-gaps">
          <strong>Speed it up</strong>
          <ul>{gaps.map((g) => <li key={g.label}><Link href={g.href} className="app-link">{g.label}<ChevronRight size={16} aria-hidden /></Link></li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}

export type HomePack = { view: ComponentProps<typeof StarterPack>["pack"]; photoUrls: Record<string, string | null>; hasCity: boolean; regenLeft: number; photoFlagged?: boolean };

function NextGaps({ gaps }: { gaps: SetupItem[] }) {
  return (
    <section className="app-card app-next" aria-label="Make it better" style={{ marginTop: 14 }}>
      <div className="app-next-gaps" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
        <strong>Make your pack better</strong>
        <ul>{gaps.map((g) => <li key={g.label}><Link href={g.href} className="app-link">{g.label}<ChevronRight size={16} aria-hidden /></Link></li>)}</ul>
      </div>
    </section>
  );
}

/** What the Home status rows need to say the truth about each app: paid or not, a report hold, and how long the client has waited. */
export type HomeFulfilment = CopyContext;

export function HomeView({ name, apps, chats, upcoming, needsYou, matchesThisWeek, gaps = [], base = "", pack, fulfilment = { paid: true } }: {
  name: string; apps: AppAccountRow[]; chats: ChatSummary[]; upcoming: DateRow[]; needsYou: ChatSummary[]; matchesThisWeek: number; gaps?: SetupItem[]; base?: string; pack?: HomePack; fulfilment?: HomeFulfilment;
}) {
  const quiet = chats.length === 0 && upcoming.length === 0;
  const accounts = APPS.flatMap((app) => apps.filter((a) => a.app === app));
  const packNode = pack && !base ? <StarterPack pack={pack.view} apps={apps} photoUrls={pack.photoUrls} hasCity={pack.hasCity} regenLeft={pack.regenLeft} photoFlagged={pack.photoFlagged} /> : null;
  return (
    <>
      <h1 className="app-h1">Hi {name || "there"}.</h1>
      <p className="app-sub">Here&rsquo;s your week.</p>

      {quiet && !base ? (
        <div style={{ marginTop: 18 }}>
          {packNode ? <>{packNode}{gaps.length ? <NextGaps gaps={gaps} /> : null}</> : <NextSteps apps={apps} gaps={gaps} />}
        </div>
      ) : null}

      <h2 className="app-h2">Your apps</h2>
      {accounts.length === 0 ? (
        <Empty title="No apps yet">Pick the apps you want us to run in your profile. <Link href={`${base}/profile`} className="app-link">Add an app</Link></Empty>
      ) : (
        <ul className="app-list">
          {accounts.map((a) => {
            const copy = appCopy(a, fulfilment);
            const status = a.user_paused || fulfilment.hold ? null : a.status;
            return (
              <li key={a.app} className="app-row" data-testid={`app-status-${a.app}`} data-status={fulfilment.hold ? "held" : a.user_paused ? "paused" : a.status}>
                <AppBadge app={a.app} />
                <div className="app-row-body">
                  <div className="app-row-title">{APP_LABELS[a.app]} <span className="app-pill" data-tone={copy.tone}><i />{copy.label}</span></div>
                  <div className="app-row-sub" style={{ whiteSpace: "normal" }}>{copy.text}</div>
                  {status === "needs_client_action" ? <Link href={`${base}/profile`} className="app-link">Open Profile<ChevronRight size={16} aria-hidden /></Link> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {quiet && !base && matchesThisWeek === 0 ? null : <><h2 className="app-h2">This week</h2>
      <div className="app-stats">
        <div className="app-stat" data-c="coral"><span>Matches</span><strong>{matchesThisWeek}</strong></div>
        <div className="app-stat" data-c="lilac"><span>Active chats</span><strong>{chats.length}</strong></div>
        <div className="app-stat" data-c="lime"><span>Upcoming dates</span><strong>{upcoming.length}</strong></div>
      </div></>}

      <h2 className="app-h2">Needs you</h2>
      {needsYou.length === 0 ? (
        <Empty title="Nothing needs you right now" icon={<Sparkles size={24} />}>When a chat needs your call, it shows up here.</Empty>
      ) : (
        <ul className="app-list">
          {needsYou.map((c) => (
            <li key={c.id}>
              <RowLink href={`${base}/chats/${c.id}`}>
                <Avatar name={c.name} url={c.photoUrl} />
                <div className="app-row-body">
                  <div className="app-row-title">{c.name} needs you</div>
                  <div className="app-row-sub">{c.needs_reason ?? "Open the chat to take over."}</div>
                </div>
                <ChevronRight className="app-row-end" size={20} aria-hidden="true" />
              </RowLink>
            </li>
          ))}
        </ul>
      )}

      <h2 className="app-h2">Upcoming dates</h2>
      {upcoming.length === 0 ? (
        <Empty title="No dates booked yet" icon={<CalendarDays size={24} />}>Booked dates land here with the place and time.</Empty>
      ) : (
        <ul className="app-list">
          {upcoming.slice(0, 3).map((d) => (
            <li key={d.id}>
              <RowLink href={`${base}/dates/${d.id}`}>
                <span className="app-badge" style={{ background: "var(--lime)", color: "var(--grape)" }} aria-hidden="true"><CalendarDays size={22} /></span>
                <div className="app-row-body">
                  <div className="app-row-title">{d.who}</div>
                  <div className="app-row-sub">{d.venue} · <When iso={d.starts_at} style="short" /></div>
                </div>
                <ChevronRight className="app-row-end" size={20} aria-hidden="true" />
              </RowLink>
            </li>
          ))}
        </ul>
      )}

      {!quiet && packNode ? <div style={{ marginTop: 26 }}>{packNode}</div> : null}

      {chats.length > 0 ? (
        <>
          <h2 className="app-h2">Active chats</h2>
          <ul className="app-list">
            {chats.slice(0, 3).map((c) => (
              <li key={c.id}>
                <RowLink href={`${base}/chats/${c.id}`}>
                  <Avatar name={c.name} url={c.photoUrl} />
                  <div className="app-row-body">
                    <div className="app-row-title">{c.name} <ModePill mode={c.mode} paused={c.paused} /></div>
                    <div className="app-row-sub">{c.last?.body ?? "Matched. First message coming up."}</div>
                  </div>
                  <MessageCircle className="app-row-end" size={20} aria-hidden="true" />
                </RowLink>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

export function ChatsView({ chats, apps = [], gaps = [], base = "" }: { chats: ChatSummary[]; apps?: AppAccountRow[]; gaps?: SetupItem[]; base?: string }) {
  return (
    <>
      <h1 className="app-h1">Chats</h1>
      <p className="app-sub">Your conversations, as they happen. Open one to read along or take over.</p>
      <div style={{ marginTop: 18 }}>
        {chats.length === 0 ? (
          <>
            <Empty title="No chats yet" icon={<MessageCircle size={24} />}>When you match with someone, the conversation shows up here. You can read along and jump in any time.</Empty>
            {base ? null : <div style={{ marginTop: 14 }}><NextSteps apps={apps} gaps={gaps} /></div>}
          </>
        ) : (
          <ul className="app-list">
            {chats.map((c) => (
              <li key={c.id}>
                <RowLink href={`${base}/chats/${c.id}`}>
                  <Avatar name={c.name} url={c.photoUrl} large />
                  <div className="app-row-body">
                    <div className="app-row-title">{c.name}{c.age ? `, ${c.age}` : ""} <span className="app-muted" style={{ fontWeight: 600, fontSize: 13 }}>{APP_LABELS[c.app]}</span></div>
                    <div className="app-row-sub">{c.last ? `${c.last.sender === "match" ? "" : "You: "}${c.last.body}` : "No messages yet"}</div>
                    <div style={{ marginTop: 6 }}><ModePill mode={c.mode} paused={c.paused} /></div>
                  </div>
                  {c.last ? <span className="app-row-end" style={{ fontSize: 12, fontWeight: 700, alignSelf: "flex-start", marginTop: 6 }}><When iso={c.last.sent_at} style="time" /></span> : null}
                </RowLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function DatesView({ dates, apps = [], gaps = [], base = "" }: { dates: DateRow[]; apps?: AppAccountRow[]; gaps?: SetupItem[]; base?: string }) {
  const { upcoming, past } = splitDates(dates);
  const row = (d: DateRow) => (
    <li key={d.id}>
      <RowLink href={`${base}/dates/${d.id}`}>
        <span className="app-badge" style={{ background: "var(--lime)", color: "var(--grape)" }} aria-hidden="true"><CalendarDays size={22} /></span>
        <div className="app-row-body">
          <div className="app-row-title">{d.who}</div>
          <div className="app-row-sub">{d.venue}</div>
          <div className="app-row-sub"><When iso={d.starts_at} style="full" /></div>
        </div>
        <ChevronRight className="app-row-end" size={20} aria-hidden="true" />
      </RowLink>
    </li>
  );
  return (
    <>
      <h1 className="app-h1">Dates</h1>
      <p className="app-sub">Who, where and when.</p>
      <div style={{ marginTop: 18 }}>
        {dates.length === 0 ? (
          <>
            <Empty title="No dates booked yet" icon={<CalendarDays size={24} />}>When a date is booked, it shows up here with the place, the time and what you two talked about.</Empty>
            {base ? null : <div style={{ marginTop: 14 }}><NextSteps apps={apps} gaps={gaps} /></div>}
          </>
        ) : (
          <>
            {upcoming.length ? <ul className="app-list">{upcoming.map(row)}</ul> : <Empty title="Nothing coming up">Your past dates are below.</Empty>}
            {past.length ? <><h2 className="app-h2">Past</h2><ul className="app-list">{past.map(row)}</ul></> : null}
          </>
        )}
      </div>
    </>
  );
}

export function DateDetailView({ date, base = "" }: { date: DateRow & { match_id: string | null }; base?: string }) {
  return (
    <>
      <Link href={`${base}/dates`} className="app-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: -6 }}><ChevronLeft size={20} aria-hidden /> Dates</Link>
      <div className="app-hero" style={{ marginTop: 6 }}>
        <div>
          <span className="tag">{date.status === "cancelled" ? "Cancelled" : "Booked"}</span>
          <h1>Date with {date.who}</h1>
        </div>
      </div>
      <ul className="app-list" style={{ marginTop: 12 }}>
        <li className="app-detail"><User size={22} aria-hidden /><div><small>Who</small><strong>{date.who}</strong></div></li>
        <li className="app-detail"><MapPin size={22} aria-hidden /><div><small>Where</small><strong>{date.venue}</strong>{date.address ? <div className="app-muted" style={{ fontSize: 15 }}>{date.address}</div> : null}</div></li>
        <li className="app-detail"><Clock size={22} aria-hidden /><div><small>When</small><strong><When iso={date.starts_at} style="full" /></strong></div></li>
        {date.summary ? <li className="app-detail"><MessageCircle size={22} aria-hidden /><div><small>What you talked about</small><strong style={{ fontWeight: 600 }}>{date.summary}</strong></div></li> : null}
      </ul>
      <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
        <IcsButton date={{ id: date.id, who: date.who, venue: date.venue, address: date.address, starts_at: date.starts_at, summary: date.summary, status: date.status }} />
        {date.match_id ? <Link href={`${base}/chats/${date.match_id}`} className="app-btn ghost">Open the chat</Link> : null}
      </div>
    </>
  );
}
