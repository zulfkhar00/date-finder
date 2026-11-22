import Link from "next/link";
import type { ComponentProps } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, MessageCircle, User } from "lucide-react";
import { Avatar, Empty, ModePill, RowLink } from "@/components/app/ui";
import { IcsButton } from "@/components/app/ics-button";
import { When } from "@/components/app/when";
import { StarterPack } from "@/components/app/starter-pack";
import { ReplyHelperCard } from "@/components/app/reply-helper-card";
import type { ChatSummary, SetupItem } from "@/lib/app/data";
import { APP_LABELS, APPS, splitDates, type AppAccountRow, type DateRow } from "@/lib/app/domain";
import { type CopyContext } from "@/lib/app/status-copy";
import { AccountCards, realAccountApi, type AccountApi } from "@/components/app/accounts";
import { DateActions } from "@/components/app/date-actions";
import type { ActivityRow } from "@/lib/app/activity";

// Presentational screens. The real pages (server components, real data) and /demo (sample data) both render
// these, so the two are the same pixels. `base` is "" for the app and "/demo" for the demo.

/** Shown while there is nothing to read yet: says what is happening and what the user can do now. */
export function NextSteps({ apps, gaps, compact }: { apps: AppAccountRow[]; gaps: SetupItem[]; compact?: boolean }) {
  const names = APPS.filter((a) => apps.some((x) => x.app === a)).map((a) => APP_LABELS[a]).join(", ");
  return (
    <section className="app-card app-next" aria-label="What happens next">
      {compact ? null : <h2 style={{ fontSize: 17, fontWeight: 800 }}>What happens next</h2>}
      <ol className="app-steps">
        <li><span aria-hidden>1</span><div><strong>We create your dating profiles</strong><p>{names ? `On ${names}, from your photos and answers. You don't log in to anything.` : "On the apps you pick, from your photos and answers. You don't log in to anything."}</p></div></li>
        <li><span aria-hidden>2</span><div><strong>We swipe and chat as you</strong><p>Matches and chats show up here as they happen. Read along, pause, or take over any time.</p></div></li>
        <li><span aria-hidden>3</span><div><strong>Dates land in Dates, you just show up</strong><p>With the place and the time. You confirm or decline, and we email you if you have that on.</p></div></li>
      </ol>
      {gaps.length ? (
        <div className="app-next-gaps">
          <strong>Help us start faster</strong>
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
        <strong>Make your profile better</strong>
        <ul>{gaps.map((g) => <li key={g.label}><Link href={g.href} className="app-link">{g.label}<ChevronRight size={16} aria-hidden /></Link></li>)}</ul>
      </div>
    </section>
  );
}

/** What the Home status rows need to say the truth about each app: paid or not, a report hold, and how long the client has waited. */
export type HomeFulfilment = CopyContext;

export function HomeView({ name, apps, chats, upcoming, needsYou, matchesThisWeek, gaps = [], base = "", pack, fulfilment = { paid: true }, afterNeeds, activity = null, nowMs = 0, accountApi = realAccountApi }: {
  name: string; apps: AppAccountRow[]; chats: ChatSummary[]; upcoming: DateRow[]; needsYou: ChatSummary[]; matchesThisWeek: number; gaps?: SetupItem[]; base?: string; pack?: HomePack; fulfilment?: HomeFulfilment;
  /** What the phone rig did in the last 48 h (null = the feed is not set up yet), the page time used for "today", and the Pause / Take over / Resume calls (the demo passes stubs). */
  activity?: readonly ActivityRow[] | null; nowMs?: number; accountApi?: AccountApi;
  /** Extra block right under "Needs you" (the owner preview puts dates waiting for an OK here). */
  afterNeeds?: React.ReactNode;
}) {
  const quiet = chats.length === 0 && upcoming.length === 0;
  const accounts = APPS.flatMap((app) => apps.filter((a) => a.app === app));
  const hasChatsByApp = Object.fromEntries(APPS.map((a) => [a, chats.some((c) => c.app === a)]));
  const packNode = pack && !base ? <StarterPack pack={pack.view} apps={apps} photoUrls={pack.photoUrls} hasCity={pack.hasCity} regenLeft={pack.regenLeft} photoFlagged={pack.photoFlagged} /> : null;
  return (
    <>
      <h1 className="app-h1">Hi {name || "there"}.</h1>
      <p className="app-sub">We create your dating profiles and run them for you. You just show up.</p>

      <h2 className="app-h2">Your apps</h2>
      {accounts.length === 0 ? (
        <Empty title="No apps yet"><Link href={`${base}/profile`} className="app-link">Pick your apps</Link></Empty>
      ) : (
        <AccountCards apps={accounts} ctx={fulfilment} activity={activity} nowMs={nowMs} base={base} api={accountApi} hasChatsByApp={hasChatsByApp} />
      )}

      {quiet && !base ? (
        <div style={{ marginTop: 18 }}>
          {packNode ? <>{packNode}{gaps.length ? <NextGaps gaps={gaps} /> : null}</> : <NextSteps apps={apps} gaps={gaps} />}
        </div>
      ) : null}

      {quiet && !base && matchesThisWeek === 0 ? null : <><h2 className="app-h2">This week</h2>
      <div className="app-stats">
        <div className="app-stat" data-c="coral"><span>Matches</span><strong>{matchesThisWeek}</strong></div>
        <div className="app-stat" data-c="lilac"><span>Active chats</span><strong>{chats.length}</strong></div>
        <div className="app-stat" data-c="lime"><span>Upcoming dates</span><strong>{upcoming.length}</strong></div>
      </div></>}

      {needsYou.length === 0 ? null : (<>
        <h2 className="app-h2">Needs you</h2>
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
      </>)}

      {afterNeeds}

      {upcoming.length === 0 ? null : (<>
        <h2 className="app-h2">Upcoming dates</h2>
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
      </>)}

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
                    <div className="app-row-sub">{c.last?.body ?? "Matched. We're writing the first message."}</div>
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
      <p className="app-sub">The chats we&rsquo;re having as you. Open one to read along or take over.</p>
      {base ? null : <div style={{ marginTop: 18 }}><ReplyHelperCard empty={chats.length === 0} /></div>}
      <div style={{ marginTop: 18 }}>
        {chats.length === 0 ? (
          <>
            <Empty title="No chats yet" icon={<MessageCircle size={24} />}>When we match with someone as you, the conversation shows up here. You can read along and jump in any time.</Empty>
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

export function DatesView({ dates, apps = [], gaps = [], base = "", dateApi }: { dates: DateRow[]; apps?: AppAccountRow[]; gaps?: SetupItem[]; base?: string; dateApi?: ComponentProps<typeof DateActions>["api"] }) {
  const { upcoming, past } = splitDates(dates);
  const pending = upcoming.filter((d) => (d.client_response ?? "pending") === "pending");
  const row = (d: DateRow, withActions = false) => (
    <li key={d.id} className={withActions ? "app-card date-card" : undefined}>
      <RowLink href={`${base}/dates/${d.id}`}>
        <span className="app-badge" style={{ background: "var(--lime)", color: "var(--grape)" }} aria-hidden="true"><CalendarDays size={22} /></span>
        <div className="app-row-body">
          <div className="app-row-title">{d.who} {d.client_response === "confirmed" ? <span className="app-pill" data-tone="lime"><i />Confirmed</span> : upcoming.includes(d) ? <span className="app-pill" data-tone="coral"><i />To confirm</span> : null}</div>
          <div className="app-row-sub">{d.venue}</div>
          <div className="app-row-sub"><When iso={d.starts_at} style="full" /></div>
        </div>
        <ChevronRight className="app-row-end" size={20} aria-hidden="true" />
      </RowLink>
      {withActions ? <DateActions id={d.id} who={d.who} api={dateApi} /> : null}
    </li>
  );
  return (
    <>
      <h1 className="app-h1">Dates</h1>
      <p className="app-sub">Dates we booked for you. Confirm the ones you&rsquo;ll be at, or decline and we&rsquo;ll rearrange.</p>
      <div style={{ marginTop: 18 }}>
        {dates.length === 0 ? (
          <>
            <Empty title="No dates booked yet" icon={<CalendarDays size={24} />}>When we book you a date, it shows up here with the place, the time and what you two talked about. We start within 72 hours of you activating.</Empty>
            {base ? null : <div style={{ marginTop: 14 }}><NextSteps apps={apps} gaps={gaps} /></div>}
          </>
        ) : (
          <>
            {upcoming.length ? <ul className="app-list">{upcoming.map((d) => row(d, pending.includes(d) && (!base || Boolean(dateApi))))}</ul> : <Empty title="Nothing coming up">Your past dates are below.</Empty>}
            {past.length ? <><h2 className="app-h2">Past</h2><ul className="app-list">{past.map((d) => row(d))}</ul></> : null}
          </>
        )}
      </div>
    </>
  );
}

export function DateDetailView({ date, base = "", tag, actions, hideIcs }: { date: DateRow & { match_id: string | null }; base?: string; tag?: string; actions?: React.ReactNode; hideIcs?: boolean }) {
  return (
    <>
      <Link href={`${base}/dates`} className="app-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: -6 }}><ChevronLeft size={20} aria-hidden /> Dates</Link>
      <div className="app-hero" style={{ marginTop: 6 }}>
        <div>
          <span className="tag">{tag ?? (date.status === "cancelled" ? "Cancelled" : "Booked")}</span>
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
        {hideIcs ? null : <IcsButton date={{ id: date.id, who: date.who, venue: date.venue, address: date.address, starts_at: date.starts_at, summary: date.summary, status: date.status }} />}
        {actions}
        {date.match_id ? <Link href={`${base}/chats/${date.match_id}`} className="app-btn ghost">Open the chat</Link> : null}
      </div>
    </>
  );
}
