"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft } from "lucide-react";
import { DateDetailView } from "@/components/app/views";
import { Empty } from "@/components/app/ui";
import { When } from "@/components/app/when";
import { dateApi } from "@/components/app/mock/actions";
import { isPastDate, type DateOutcome, type MockDate } from "@/lib/app/mock-core";
import { useMock } from "@/lib/app/mock-store";

const OUTCOMES: { key: DateOutcome; label: string }[] = [{ key: "great", label: "It went great" }, { key: "fine", label: "It was fine" }, { key: "nope", label: "Not for me" }];

function Proposed({ date }: { date: MockDate }) {
  const [slot, setSlot] = useState(date.starts_at);
  const [busy, setBusy] = useState<"" | "confirm" | "decline">("");
  const [asking, setAsking] = useState(false);
  const times = [date.starts_at, ...date.slots.filter((x) => x !== date.starts_at)];
  async function confirm() {
    if (busy) return;
    setBusy("confirm");
    await dateApi.confirm(date.id, slot);
    setBusy("");
  }
  async function decline() {
    if (busy) return;
    setBusy("decline");
    await dateApi.cancel(date.id);
    setBusy("");
  }
  return (
    <>
      <section className="app-card" aria-label="Pick a time">
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>Time that works for you</h2>
        <div className="app-slots" style={{ marginTop: 10 }} role="group" aria-label="Time">
          {times.map((t) => (
            <button key={t} type="button" className="app-chip" aria-pressed={slot === t} disabled={busy !== ""} onClick={() => setSlot(t)}>
              {slot === t ? <Check size={16} strokeWidth={3} aria-hidden /> : null}<When iso={t} style="short" />
            </button>
          ))}
        </div>
      </section>
      <button type="button" className="app-btn" disabled={busy !== ""} aria-busy={busy === "confirm"} onClick={confirm}>
        {busy === "confirm" ? <><span className="app-spinner" aria-hidden /> Confirming…</> : "Confirm this date"}
      </button>
      {asking ? (
        <div className="app-card" style={{ display: "grid", gap: 10 }}>
          <strong>Decline this date with {date.who}?</strong>
          <p className="app-fine" style={{ margin: 0 }}>It moves to Past as cancelled. Nothing is sent to {date.who} until you say so.</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="app-btn danger small" disabled={busy !== ""} aria-busy={busy === "decline"} onClick={decline}>{busy === "decline" ? <><span className="app-spinner" aria-hidden /> Declining…</> : "Yes, decline"}</button>
            <button type="button" className="app-btn ghost small" disabled={busy !== ""} onClick={() => setAsking(false)}>Keep it</button>
          </div>
        </div>
      ) : <button type="button" className="app-btn ghost" disabled={busy !== ""} onClick={() => setAsking(true)}>Not this one</button>}
    </>
  );
}

function CancelBooked({ date }: { date: MockDate }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  async function cancel() {
    if (busy) return;
    setBusy(true);
    await dateApi.cancel(date.id);
    setBusy(false);
  }
  if (!asking) return <button type="button" className="app-btn ghost" onClick={() => setAsking(true)}>Cancel this date</button>;
  return (
    <div className="app-card" style={{ display: "grid", gap: 10 }}>
      <strong>Cancel the date with {date.who}?</strong>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="app-btn danger small" disabled={busy} aria-busy={busy} onClick={cancel}>{busy ? <><span className="app-spinner" aria-hidden /> Cancelling…</> : "Yes, cancel"}</button>
        <button type="button" className="app-btn ghost small" disabled={busy} onClick={() => setAsking(false)}>Keep it</button>
      </div>
    </div>
  );
}

function Outcome({ date }: { date: MockDate }) {
  const [busy, setBusy] = useState<DateOutcome | "">("");
  async function pick(o: DateOutcome) {
    if (busy) return;
    setBusy(o);
    await dateApi.rate(date.id, o);
    setBusy("");
  }
  return (
    <section className="app-card" aria-label="How did it go?">
      <h2 style={{ fontSize: 17, fontWeight: 800 }}>How did it go?</h2>
      <p className="app-fine" style={{ marginTop: 4 }}>Only you see this. It shapes who we line up next.</p>
      <div className="app-chips" style={{ marginTop: 12 }} role="group" aria-label="Outcome">
        {OUTCOMES.map((o) => (
          <button key={o.key} type="button" className="app-chip" aria-pressed={date.outcome === o.key} disabled={busy !== ""} aria-busy={busy === o.key} onClick={() => pick(o.key)}>
            {busy === o.key ? <span className="app-spinner" aria-hidden /> : date.outcome === o.key ? <Check size={16} strokeWidth={3} aria-hidden /> : null}{o.label}
          </button>
        ))}
      </div>
    </section>
  );
}

export function MockDateDetail({ id }: { id: string }) {
  const s = useMock();
  const [now] = useState(() => Date.now());
  if (!s) return null;
  const d = s.dates.find((x) => x.id === id);
  if (!d) {
    return (
      <>
        <Link href="/app/dates" className="app-link" style={{ display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", marginLeft: -6 }}><ChevronLeft size={20} aria-hidden /> Dates</Link>
        <div style={{ marginTop: 18 }}><Empty title="This date isn't here">It may have been cleared when the sample data was reset.</Empty></div>
      </>
    );
  }
  const row = { id: d.id, who: d.who, venue: d.venue, address: d.address, starts_at: d.starts_at, summary: d.summary, status: d.status === "cancelled" ? "cancelled" : "booked", match_id: d.match_id };
  const past = isPastDate(d, now);
  const tag = d.status === "proposed" ? "Proposed" : d.status === "cancelled" ? "Cancelled" : past ? "Past" : "Booked";
  const actions = d.status === "proposed" ? <Proposed key={d.id} date={d} /> : d.status === "booked" && past ? <Outcome date={d} /> : d.status === "booked" ? <CancelBooked key={d.id} date={d} /> : null;
  return <DateDetailView base="/app" date={row} tag={tag} hideIcs={d.status !== "booked"} actions={actions} />;
}
