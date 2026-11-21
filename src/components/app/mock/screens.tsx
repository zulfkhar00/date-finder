"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarDays, ChevronRight, Check } from "lucide-react";
import { ChatsView, HomeView } from "@/components/app/views";
import { Empty, RowLink } from "@/components/app/ui";
import { When } from "@/components/app/when";
import { dateApi } from "@/components/app/mock/actions";
import { chatSummaries, dateGroups, dateRows, isPastDate, needsYouChats, type MockDate } from "@/lib/app/mock-core";
import { useMock } from "@/lib/app/mock-store";

const BASE = "/app";

/** Dates the user has not OK'd yet. Shown on Home and at the top of Dates. */
export function ProposedDates({ dates, heading = true }: { dates: MockDate[]; heading?: boolean }) {
  const [busy, setBusy] = useState("");
  if (!dates.length) return null;
  async function confirm(id: string) {
    if (busy) return;
    setBusy(id);
    await dateApi.confirm(id);
    setBusy("");
  }
  return (
    <>
      {heading ? <h2 className="app-h2">Dates to confirm</h2> : null}
      <ul className="app-list">
        {dates.map((d) => (
          <li key={d.id} className="app-card" style={{ display: "grid", gap: 12 }}>
            <Link href={`${BASE}/dates/${d.id}`} className="app-row" style={{ border: 0, padding: 0, background: "none", boxShadow: "none" }}>
              <span className="app-badge" style={{ background: "var(--lilac)", color: "var(--grape)" }} aria-hidden="true"><CalendarClock size={22} /></span>
              <div className="app-row-body">
                <div className="app-row-title">{d.who} <span className="app-pill" data-tone="coral"><i />Proposed</span></div>
                <div className="app-row-sub">{d.venue}</div>
                <div className="app-row-sub"><When iso={d.starts_at} style="full" /></div>
              </div>
              <ChevronRight className="app-row-end" size={20} aria-hidden="true" />
            </Link>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="app-btn small" disabled={busy !== ""} aria-busy={busy === d.id} onClick={() => confirm(d.id)}>
                {busy === d.id ? <><span className="app-spinner" aria-hidden /> Confirming…</> : <><Check size={18} aria-hidden /> Confirm</>}
              </button>
              <Link href={`${BASE}/dates/${d.id}`} className="app-btn ghost small">Change or decline</Link>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

export function MockHome() {
  const s = useMock();
  // Which dates count as upcoming depends on the clock (taken once, when the screen opens).
  const [now] = useState(() => Date.now());
  if (!s) return null;
  const groups = dateGroups(s, now);
  return (
    <HomeView
      base={BASE} name={s.profile.firstName} apps={s.apps} chats={chatSummaries(s)} needsYou={needsYouChats(s)}
      upcoming={dateRows(s).filter((d) => groups.upcoming.some((u) => u.id === d.id))} matchesThisWeek={s.matchesThisWeek}
      afterNeeds={groups.proposed.length ? <ProposedDates dates={groups.proposed} /> : null}
    />
  );
}

export function MockChats() {
  const s = useMock();
  if (!s) return null;
  return <ChatsView base={BASE} chats={chatSummaries(s)} apps={s.apps} />;
}

export function MockDates() {
  const s = useMock();
  const [now] = useState(() => Date.now());
  if (!s) return null;
  const { proposed, upcoming, past } = dateGroups(s, now);
  const row = (d: MockDate) => (
    <li key={d.id}>
      <RowLink href={`${BASE}/dates/${d.id}`}>
        <span className="app-badge" style={{ background: d.status === "cancelled" ? "#E9E1F2" : "var(--lime)", color: "var(--grape)" }} aria-hidden="true"><CalendarDays size={22} /></span>
        <div className="app-row-body">
          <div className="app-row-title">{d.who}{d.status === "cancelled" ? <> <span className="app-pill" data-tone="grey"><i />Cancelled</span></> : isPastDate(d, now) && !d.outcome ? <> <span className="app-pill" data-tone="coral"><i />How did it go?</span></> : null}</div>
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
        {s.dates.length === 0 ? (
          <Empty title="No dates booked yet" icon={<CalendarDays size={24} />}>When a date is proposed or booked, it shows up here with the place, the time and what you two talked about.</Empty>
        ) : (
          <>
            <ProposedDates dates={proposed} heading={false} />
            {proposed.length ? <h2 className="app-h2">Upcoming</h2> : null}
            {upcoming.length ? <ul className="app-list">{upcoming.map(row)}</ul> : <Empty title="Nothing booked yet">{proposed.length ? "Confirm a date above and it lands here." : "Your past dates are below."}</Empty>}
            {past.length ? <><h2 className="app-h2">Past</h2><ul className="app-list">{past.map(row)}</ul></> : null}
          </>
        )}
      </div>
    </>
  );
}
