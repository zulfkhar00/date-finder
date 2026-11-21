"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, CalendarClock, ImagePlus, Trash2, X } from "lucide-react";
import { CopyButton } from "@/components/app/starter-pack-client";
import { MAX_IMAGES, MAX_TEXT_CHARS, TWEAKS, TWEAK_LABELS, type ThreadView, type Tweak } from "@/lib/reply-helper/types";

// The Reply helper: choose 1-4 screenshots (camera roll) or paste the chat, get three replies, a read of the chat and,
// when it is time, a date move. The screenshots are shrunk in the browser, sent once, and never stored. Nothing is sent
// to anyone: the user copies a draft and pastes it into their own app.

type Picked = { key: string; blob: Blob; url: string; name: string };
type Failure = { code: string; message: string };

/** Shrinks a screenshot to a JPEG of at most ~1600 px: a phone screenshot is 3-8 MB, a chat reads fine at ~300 KB. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob && blob.size > 0) return blob;
  } catch { /* fall back to the original below */ }
  return file;
}

const when = (iso: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function ReplyHelper({ threads: initial, activeId = null }: { threads: ThreadView[]; activeId?: string | null }) {
  const [threads, setThreads] = useState(initial);
  const [thread, setThread] = useState<ThreadView | null>(() => initial.find((t) => t.id === activeId) ?? null);
  const [mode, setMode] = useState<"screenshots" | "text">("screenshots");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [text, setText] = useState("");
  const [working, setWorking] = useState<null | "new" | "regenerate" | "tweak" | Tweak>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const seen = useRef(new Set<string>());
  const urls = useRef<string[]>([]);
  useEffect(() => () => { for (const u of urls.current) URL.revokeObjectURL(u); }, []);

  async function addFiles(list: FileList | null) {
    if (!list) return;
    setNotice(null); setFailure(null);
    const fresh: { file: File; key: string }[] = [];
    for (const f of Array.from(list)) {
      const key = `${f.name}:${f.size}:${f.lastModified}`;
      if (seen.current.has(key) || !f.type.startsWith("image/")) continue; // the same screenshot twice counts once
      seen.current.add(key);
      fresh.push({ file: f, key });
    }
    const room = MAX_IMAGES - picked.length;
    if (fresh.length > room) setNotice(`Up to ${MAX_IMAGES} screenshots. We kept the first ${MAX_IMAGES}.`);
    for (const dropped of fresh.slice(Math.max(0, room))) seen.current.delete(dropped.key);
    const next: Picked[] = [];
    for (const { file, key } of fresh.slice(0, Math.max(0, room))) {
      const blob = await shrink(file);
      const url = URL.createObjectURL(blob);
      urls.current.push(url);
      next.push({ key, blob, url, name: file.name });
    }
    setPicked((cur) => [...cur, ...next].slice(0, MAX_IMAGES));
    if (input.current) input.current.value = ""; // choosing the same file again must fire change
  }

  function removeAt(key: string) {
    setPicked((cur) => cur.filter((p) => p.key !== key));
    seen.current.delete(key);
  }

  async function send(kind: "new" | "regenerate" | "tweak", tweak?: Tweak) {
    if (busy.current) return; // double tap or double submit: one request
    const body = new FormData();
    body.set("kind", kind);
    if (kind === "new") {
      if (mode === "screenshots") picked.forEach((p, i) => body.append("files", p.blob, `chat-${i + 1}.jpg`));
      else body.set("text", text);
    } else if (thread) {
      body.set("threadId", thread.id);
      if (tweak) body.set("tweak", tweak);
    } else return;
    busy.current = true;
    setWorking(kind === "tweak" && tweak ? tweak : kind);
    setFailure(null); setNotice(null);
    try {
      const res = await fetch("/api/app/reply", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { thread?: ThreadView; code?: string; error?: string };
      if (!res.ok || !data.thread) {
        setFailure({ code: data.code ?? "failed", message: data.error ?? "Something went wrong. Try again in a minute." });
        return;
      }
      const saved = data.thread;
      setThread(saved);
      setThreads((cur) => [saved, ...cur.filter((t) => t.id !== saved.id)]);
      window.history.replaceState(null, "", `/chats/reply?t=${saved.id}`);
      if (kind === "new") { setPicked([]); setText(""); seen.current.clear(); }
    } catch {
      setFailure({ code: "network", message: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      busy.current = false;
      setWorking(null);
    }
  }

  function reset() {
    setThread(null); setFailure(null); setNotice(null); setPicked([]); setText(""); seen.current.clear();
    window.history.replaceState(null, "", "/chats/reply");
  }

  async function remove(id: string) {
    if (busy.current) return;
    busy.current = true;
    try {
      const res = await fetch(`/api/app/reply?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setThreads((cur) => cur.filter((t) => t.id !== id));
        if (thread?.id === id) reset();
      } else setFailure({ code: "delete", message: "Couldn't delete that. Try again." });
    } catch {
      setFailure({ code: "network", message: "Couldn't reach the server. Check your connection and try again." });
    } finally { busy.current = false; }
  }

  const trackCopy = () => { void fetch("/api/app/reply/copied", { method: "POST", keepalive: true }).catch(() => undefined); };
  const canSend = mode === "screenshots" ? picked.length > 0 : text.trim().length >= 8;
  const isWorking = working !== null;

  return (
    <div className="rh">
      {thread ? (
        <section aria-label="Your replies" data-testid="rh-result" className="rh-result">
          <div className="app-card rh-read">
            <span className="app-pill"><i />Where it stands</span>
            <p data-testid="rh-read">{thread.drafts.read}</p>
          </div>

          <h2 className="app-h2">Pick a reply</h2>
          <ol className="rh-replies" aria-busy={isWorking}>
            {thread.drafts.replies.map((r, i) => (
              <li key={`${i}-${r.text}`} className="app-card rh-reply" data-testid="rh-reply">
                <span className="app-pill" data-tone={i === 0 ? "lime" : undefined}>{r.angle}</span>
                <div className="sp-line"><p>{r.text}</p><CopyButton text={r.text} onCopied={trackCopy} /></div>
              </li>
            ))}
          </ol>

          <div className="rh-chips" role="group" aria-label="Change the replies">
            {TWEAKS.map((t) => (
              <button key={t} type="button" className="rh-chip" data-active={thread.tweak === t} disabled={isWorking} aria-busy={working === t} onClick={() => send("tweak", t)}>
                {working === t ? <span className="app-spinner" aria-hidden /> : null}{TWEAK_LABELS[t]}
              </button>
            ))}
            <button type="button" className="rh-chip" disabled={isWorking} aria-busy={working === "regenerate"} onClick={() => send("regenerate")}>
              {working === "regenerate" ? <span className="app-spinner" aria-hidden /> : null}Write them again
            </button>
          </div>

          {thread.drafts.dateMove ? (
            <section className="app-card rh-date" aria-label="Suggest a date" data-testid="rh-date">
              <div className="sp-head"><CalendarClock size={18} aria-hidden /><h3>Time to ask them out</h3></div>
              <p className="app-muted sp-how">It&rsquo;s going well. Send this when it feels right.</p>
              <div className="sp-line"><p>{thread.drafts.dateMove.line}</p><CopyButton text={thread.drafts.dateMove.line} onCopied={trackCopy} /></div>
              <dl className="sp-dl">
                {thread.drafts.dateMove.plans.map((p, i) => <div key={p.title}><dt>Plan {i + 1}</dt><dd><strong>{p.title}</strong><span>{p.detail}</span></dd></div>)}
              </dl>
            </section>
          ) : null}

          {failure ? <p role="alert" className="app-error rh-error" data-testid="rh-error">{failure.message}</p> : null}
          <p className="app-fine">You send everything yourself. NoSwipe never logs in to your dating apps, and your screenshots weren&rsquo;t kept.</p>
          <button type="button" className="app-btn ghost" onClick={reset} disabled={isWorking}>Start another chat</button>
        </section>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (canSend) void send("new"); }} className="app-card rh-form" aria-label="Get replies">
          <div className="rh-tabs" role="tablist" aria-label="How to share the chat">
            <button type="button" role="tab" aria-selected={mode === "screenshots"} onClick={() => setMode("screenshots")} disabled={isWorking}>Screenshots</button>
            <button type="button" role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")} disabled={isWorking}>Paste text</button>
          </div>
          {mode === "screenshots" ? (
            <div className="rh-upload">
              <p className="app-muted">Add 1 to {MAX_IMAGES} screenshots of the conversation, the most recent messages in view.</p>
              {picked.length ? (
                <ul className="rh-thumbs" aria-label="Chosen screenshots">
                  {picked.map((p, i) => (
                    <li key={p.key}>
                      <img src={p.url} alt={`Screenshot ${i + 1}`} />
                      <button type="button" onClick={() => removeAt(p.key)} aria-label={`Remove screenshot ${i + 1}`} disabled={isWorking}><X size={16} aria-hidden /></button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {picked.length < MAX_IMAGES ? (
                <label className={`app-btn ghost rh-pick${isWorking ? " is-disabled" : ""}`}>
                  {picked.length ? <ImagePlus size={20} aria-hidden /> : <Camera size={20} aria-hidden />}
                  {picked.length ? "Add another" : "Choose screenshots"}
                  <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/*" multiple onChange={(e) => void addFiles(e.target.files)} disabled={isWorking} data-testid="rh-file" />
                </label>
              ) : null}
            </div>
          ) : (
            <label className="app-field">
              <span>The conversation</span>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_CHARS))} rows={8} placeholder={"Paste the chat here. The end is what we read most.\nThem: ...\nMe: ..."} disabled={isWorking} data-testid="rh-text" />
            </label>
          )}
          {notice ? <p role="status" className="app-muted rh-note">{notice}</p> : null}
          {failure ? <p role="alert" className="app-error rh-error" data-testid="rh-error">{failure.message}</p> : null}
          <button type="submit" className="app-btn" disabled={!canSend || isWorking} aria-busy={working === "new"} data-testid="rh-submit">
            {working === "new" ? <span className="app-spinner" aria-hidden /> : null}{working === "new" ? "Reading your chat" : "Write my replies"}
          </button>
          <p className="app-fine rh-fine">Read once to write your replies, then dropped: we don&rsquo;t keep your screenshots. Works with Hinge, Tinder and Bumble chats, in any language.</p>
        </form>
      )}

      {threads.length ? (
        <section aria-label="Saved threads" className="rh-saved">
          <h2 className="app-h2">Earlier chats</h2>
          <ul className="app-list">
            {threads.map((t) => (
              <li key={t.id} className="app-row rh-saved-row" data-active={thread?.id === t.id}>
                <button type="button" className="rh-saved-open" onClick={() => { setThread(t); setFailure(null); window.history.replaceState(null, "", `/chats/reply?t=${t.id}`); window.scrollTo({ top: 0 }); }}>
                  <span className="app-row-title">{t.drafts.read}</span>
                  <span className="app-row-sub">{when(t.updatedAt)} · {t.source === "screenshots" ? `${t.imageCount} screenshot${t.imageCount === 1 ? "" : "s"}` : "pasted text"}</span>
                </button>
                <button type="button" className="rh-del" onClick={() => void remove(t.id)} aria-label="Delete this chat" disabled={isWorking}><Trash2 size={18} aria-hidden /></button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
