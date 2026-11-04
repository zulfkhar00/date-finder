"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Hand, RotateCcw, Send } from "lucide-react";
import { Avatar, ModePill } from "@/components/app/ui";
import { When } from "@/components/app/when";
import { APP_LABELS, SENT_BY_TAG, bubbleSide, parseSystemEvent, type App, type ChatMode } from "@/lib/app/domain";
import type { MessageRow } from "@/lib/app/data";

type Result = { ok: boolean; error?: string };
export type ThreadApi = {
  takeOver: (matchId: string) => Promise<Result>;
  handBack: (matchId: string) => Promise<Result>;
  send: (matchId: string, body: string) => Promise<Result>;
};
type Props = {
  match: { id: string; name: string; age: number | null; app: App }; photoUrl: string | null; messages: MessageRow[]; mode: ChatMode; paused: boolean;
  api: ThreadApi; base?: string;
};

function dayKey(iso: string) { return new Date(iso).toDateString(); }

function SystemRow({ body }: { body: string }) {
  const event = parseSystemEvent(body);
  if (!event) return null;
  return (
    <div className="th-sys" role="note">
      <span>
        {event.kind === "took_over" ? "You took over" : event.kind === "handed_back" ? "Handed back" : <>📅 Date booked · <When iso={event.startsAt} style="compact" /> · {event.venue}</>}
      </span>
    </div>
  );
}

export function Thread({ match, photoUrl, messages, mode, paused, api, base = "" }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"" | "take" | "back" | "send">("");
  const [, startTransition] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(messages.length);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: count.current === messages.length ? "auto" : "smooth", block: "end" });
    count.current = messages.length;
  }, [messages.length]);

  async function run(kind: "take" | "back", fn: () => Promise<Result>) {
    if (busy) return;
    setBusy(kind); setError("");
    const r = await fn();
    if (!r.ok) setError(r.error ?? "Something went wrong.");
    startTransition(() => router.refresh());
    setBusy("");
  }
  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy("send"); setError("");
    const r = await api.send(match.id, body);
    if (r.ok) setText(""); else setError(r.error ?? "Couldn't send.");
    startTransition(() => router.refresh());
    setBusy("");
  }

  return (
    <div className="th">
      <div className="th-head">
        <Link href={`${base}/chats`} className="back" aria-label="Back to chats"><ChevronLeft size={26} /></Link>
        <Avatar name={match.name} url={photoUrl} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="th-name">{match.name}{match.age ? `, ${match.age}` : ""}</div>
          <div className="app-muted" style={{ fontSize: 13, fontWeight: 600 }}>{APP_LABELS[match.app]}</div>
        </div>
        <ModePill mode={mode} paused={paused} />
      </div>

      <div className="th-in">
        <div className="th-body" role="log" aria-live="polite" aria-label={`Conversation with ${match.name}`}>
          {messages.length === 0 ? <div className="app-empty" style={{ margin: "auto 0" }}><strong>No messages yet</strong>The first message will show up here.</div> : null}
          {messages.map((m, i) => {
            const side = bubbleSide(m.sender);
            const newDay = i === 0 || dayKey(messages[i - 1].sent_at) !== dayKey(m.sent_at);
            return (
              <div key={m.id} style={{ display: "contents" }}>
                {newDay ? <div className="th-day"><When iso={m.sent_at} style="day" /></div> : null}
                {side === "system" ? <SystemRow body={m.body} /> : (
                  <>
                    <div className={`th-msg ${side}`}>{m.body}</div>
                    <div className={`th-time ${side}`}>
                      {m.sender === "as_user_ai" ? <><span className="th-tag">{SENT_BY_TAG}</span> · </> : null}<When iso={m.sent_at} style="time" />
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div ref={end} />
        </div>
      </div>

      <div className="th-dock">
        <div className="th-dock-in">
          {error ? <p className="app-error" role="alert">{error}</p> : null}
          {mode === "user" ? (
            <>
              <form className="th-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
                <label className="sr-only" htmlFor="compose">Message to {match.name}</label>
                <textarea id="compose" value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={`Message ${match.name}`} maxLength={4000} disabled={busy === "send"}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
                <button type="submit" className="app-btn" disabled={busy !== "" || !text.trim()} aria-busy={busy === "send"} aria-label="Send">
                  {busy === "send" ? <span className="app-spinner" aria-hidden /> : <Send size={20} aria-hidden />}
                </button>
              </form>
              <button type="button" className="app-btn ghost" disabled={busy !== ""} aria-busy={busy === "back"} onClick={() => run("back", () => api.handBack(match.id))}>
                {busy === "back" ? <><span className="app-spinner" aria-hidden /> Handing back…</> : <><RotateCcw size={18} aria-hidden /> Hand back to NoSwipe</>}
              </button>
            </>
          ) : (
            <>
              <p className="app-muted" style={{ fontSize: 14, fontWeight: 600, textAlign: "center" }}>
                {paused ? `${APP_LABELS[match.app]} is paused, so nothing is sent for you. You can still take over.` : "Chatting as you, in your voice. Read along, or jump in any time."}
              </p>
              <button type="button" className="app-btn" disabled={busy !== ""} aria-busy={busy === "take"} onClick={() => run("take", () => api.takeOver(match.id))}>
                {busy === "take" ? <><span className="app-spinner" aria-hidden /> Taking over…</> : <><Hand size={18} aria-hidden /> Take over</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
