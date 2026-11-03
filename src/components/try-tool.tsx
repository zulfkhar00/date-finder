"use client";

/* eslint-disable @next/next/no-img-element -- previews are local blob: URLs, which next/image cannot optimize */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ImagePlus, X } from "lucide-react";
import { captureInternalLinkAttribution, getFunnelSessionId, trackEvent } from "@/lib/attribution-client";
import { getTrySessionId, ImageError, processImage, type ProcessedImage } from "@/lib/try/image-client";
import { MAX_ABOUT_CHARS, TRY_APPS, TRY_KINDS, TRY_KIND_LABELS, type TryApp, type TryErrorCode, type TryKind } from "@/lib/try/shared";
import type { PublicResult, TryResponseBody } from "@/lib/try/handler";

type Tile = { id: number; state: "processing" | "ready"; image?: ProcessedImage };
type Failure = { code: TryErrorCode | "network"; message: string };

const LOADING_STEPS: Record<TryKind, string[]> = {
  profile: ["Looking at your photos", "Ranking them, best first", "Writing your bio and prompts", "Polishing the wording"],
  opener: ["Reading their profile", "Finding what stands out", "Writing three openers", "Polishing the wording"],
  reply: ["Reading the chat", "Judging where it stands", "Writing your reply options", "Polishing the wording"]
};

const KIND_SHORT: Record<TryKind, string> = { profile: "Fix my profile", opener: "Openers for a match", reply: "Reply to a chat" };

export function TryTool() {
  const [kind, setKind] = useState<TryKind>("profile");
  const [app, setApp] = useState<TryApp>("Hinge");
  const [about, setAbout] = useState("");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [result, setResult] = useState<{ kind: TryKind; data: PublicResult; remaining: number; previews: string[] } | null>(null);
  const nextId = useRef(1);
  const tilesRef = useRef<Tile[]>([]);
  const outRef = useRef<HTMLDivElement>(null);
  useEffect(() => { tilesRef.current = tiles; }, [tiles]);

  const max = TRY_KIND_LABELS[kind].max;
  const ready = tiles.filter((tile) => tile.state === "ready");
  const busy = tiles.some((tile) => tile.state === "processing");

  // Free preview URLs when the page goes away.
  useEffect(() => () => tilesRef.current.forEach((tile) => tile.image && URL.revokeObjectURL(tile.image.previewUrl)), []);

  // Cycle the status line while a run is in flight.
  useEffect(() => {
    if (!loading) return;
    const timer = window.setInterval(() => setStep((value) => Math.min(value + 1, LOADING_STEPS[kind].length - 1)), 3800);
    return () => window.clearInterval(timer);
  }, [loading, kind]);

  const changeKind = (next: TryKind) => {
    if (next === kind || loading) return;
    setKind(next);
    setFailure(null);
    setNotice(null);
    // Keep only as many pictures as the new mode accepts.
    setTiles((current) => {
      const kept = current.slice(0, TRY_KIND_LABELS[next].max);
      current.slice(kept.length).forEach((tile) => tile.image && URL.revokeObjectURL(tile.image.previewUrl));
      return kept;
    });
  };

  const addFiles = useCallback(async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setNotice(null);
    const room = max - tilesRef.current.length;
    const files = Array.from(list).slice(0, Math.max(room, 0));
    if (list.length > room) setNotice(room <= 0 ? `You can add up to ${max} images.` : `Only the first ${room} fit. You can add up to ${max}.`);
    const created = files.map((file) => ({ file, tile: { id: nextId.current++, state: "processing" } as Tile }));
    setTiles((current) => [...current, ...created.map((item) => item.tile)]);
    await Promise.all(created.map(async ({ file, tile }) => {
      try {
        const image = await processImage(file);
        setTiles((current) => current.map((item) => (item.id === tile.id ? { ...item, state: "ready", image } : item)));
      } catch (error) {
        setTiles((current) => current.filter((item) => item.id !== tile.id));
        setNotice(error instanceof ImageError ? error.message : "We couldn't open one of those images.");
      }
    }));
  }, [max]);

  const removeTile = (id: number) => {
    setTiles((current) => {
      const target = current.find((tile) => tile.id === id);
      if (target?.image) URL.revokeObjectURL(target.image.previewUrl);
      return current.filter((tile) => tile.id !== id);
    });
  };

  const reset = () => {
    tiles.forEach((tile) => tile.image && URL.revokeObjectURL(tile.image.previewUrl));
    setTiles([]);
    setResult(null);
    setFailure(null);
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const run = async () => {
    if (loading || busy || ready.length === 0) return;
    setFailure(null);
    setResult(null);
    setStep(0);
    setLoading(true);
    trackEvent("try_start");
    const form = new FormData();
    form.set("kind", kind);
    form.set("app", app);
    form.set("about", about);
    form.set("sessionId", getTrySessionId());
    form.set("funnelSessionId", getFunnelSessionId());
    ready.forEach((tile) => tile.image && form.append("images", tile.image.file));
    const previews = ready.map((tile) => tile.image?.previewUrl ?? "");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 70_000);
    window.setTimeout(() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    try {
      const response = await fetch("/api/try", { method: "POST", body: form, signal: controller.signal });
      let body: TryResponseBody | null = null;
      try { body = (await response.json()) as TryResponseBody; } catch { body = null; }
      if (body?.ok) {
        setResult({ kind: body.kind, data: body.result, remaining: body.remaining, previews });
        window.setTimeout(() => outRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      } else if (body && !body.ok) {
        setFailure({ code: body.code, message: body.message });
      } else {
        setFailure({ code: response.status === 413 ? "too_large" : "failed", message: response.status === 413 ? "Those files are too big. Try fewer or smaller images." : "Something went wrong. Please try again." });
      }
    } catch {
      setFailure({ code: "network", message: "That took too long or the connection dropped. Check your signal and try again." });
    } finally {
      window.clearTimeout(timeout);
      setLoading(false);
    }
  };

  const limited = failure?.code === "daily_limit" || failure?.code === "capacity";

  return (
    <div className="try">
      <form className="try-form panel" onSubmit={(event) => { event.preventDefault(); void run(); }} aria-busy={loading}>
        <fieldset className="try-fieldset" disabled={loading}>
          <legend className="try-label">What do you want help with?</legend>
          <div className="try-seg" role="radiogroup" aria-label="What do you want help with?">
            {TRY_KINDS.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={kind === value} className="try-seg-btn" data-on={kind === value} onClick={() => changeKind(value)}>
                {KIND_SHORT[value]}
              </button>
            ))}
          </div>
          <p className="try-hint">{TRY_KIND_LABELS[kind].hint}</p>
        </fieldset>

        <fieldset className="try-fieldset" disabled={loading}>
          <legend className="try-label">Which app?</legend>
          <div className="try-pills" role="radiogroup" aria-label="Which app?">
            {TRY_APPS.map((value) => (
              <button key={value} type="button" role="radio" aria-checked={app === value} className="try-pill" data-on={app === value} onClick={() => setApp(value)}>
                {value}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="try-fieldset">
          <p className="try-label" id="try-upload-label">{kind === "profile" ? "Your photos or profile screenshots" : kind === "opener" ? "Their profile screenshot" : "Your chat screenshot"}</p>
          <div className="try-grid" role="list" aria-labelledby="try-upload-label">
            {tiles.map((tile, index) => (
              <div key={tile.id} className="try-tile" role="listitem" data-state={tile.state}>
                {tile.image ? <img src={tile.image.previewUrl} alt={`Selected image ${index + 1}`} /> : <span className="spinner" aria-label="Preparing image" />}
                {kind === "profile" && <span className="try-tile-num">{index + 1}</span>}
                <button type="button" className="try-tile-x" onClick={() => removeTile(tile.id)} aria-label={`Remove image ${index + 1}`} disabled={loading}><X size={16} strokeWidth={3} /></button>
              </div>
            ))}
            {tiles.length < max && (
              <label className="try-tile try-add" data-disabled={loading} role="listitem">
                <input type="file" accept="image/*" multiple={max > 1} disabled={loading} onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} />
                <ImagePlus size={26} strokeWidth={2.5} aria-hidden="true" />
                <span>{tiles.length === 0 ? "Add images" : "Add more"}</span>
              </label>
            )}
          </div>
          {notice && <p className="try-notice" role="status">{notice}</p>}
          <p className="try-fine">Pictures are shrunk and cleaned of location data on your device, then sent to our AI provider to write the draft. Never stored by us.</p>
        </div>

        <div className="try-fieldset">
          <label className="try-label" htmlFor="try-about">A few facts about you <span className="field-optional">(optional)</span></label>
          <textarea id="try-about" className="try-textarea" rows={3} maxLength={MAX_ABOUT_CHARS} value={about} disabled={loading} onChange={(event) => setAbout(event.target.value)} placeholder="Job, hobbies, how you text. Helps it sound like you." />
        </div>

        <div className="try-submit">
          <button type="submit" className="btn btn-primary btn-block" disabled={loading || busy || ready.length === 0}>
            {loading ? <><span className="spinner" aria-hidden="true" /> Working on it…</> : busy ? "Preparing images…" : "Get my free draft"}
          </button>
        </div>
      </form>

      <div ref={outRef} className="try-out" tabIndex={-1} aria-live="polite">
        {loading && (
          <div className="try-loading panel" role="status">
            <div className="try-bar" aria-hidden="true"><span /></div>
            <p className="try-loading-step">{LOADING_STEPS[kind][step]}…</p>
            <p className="try-fine">This usually takes 10 to 20 seconds. Keep this tab open.</p>
            <div className="try-skel" aria-hidden="true"><span /><span /><span /></div>
          </div>
        )}

        {failure && !loading && (
          <>
            <div className="try-error panel" role="alert">
              <p className="try-error-title">{limited ? (failure.code === "capacity" ? "Free runs are full for today" : "That's your free tries for today") : "That didn't work"}</p>
              <p>{failure.message}</p>
              {!limited && <button type="button" className="btn btn-white btn-small" onClick={() => void run()}>Try again</button>}
            </div>
            {limited && <ResultCta heading="Want this for every match?" location="try_limit" />}
          </>
        )}

        {result && !loading && (
          <section className="try-result" aria-label="Your draft">
            <ResultView result={result.data} previews={result.previews} />
            <ResultCta heading="Want this for every match?" location="try_result" remaining={result.remaining} />
            <button type="button" className="btn btn-white btn-block" onClick={reset}>Start over</button>
          </section>
        )}
      </div>
    </div>
  );
}

function ResultCta({ heading, location, remaining }: { heading: string; location: string; remaining?: number }) {
  return (
    <aside className="try-cta panel" aria-label="Get the full service">
      <p className="kicker">Like what you see?</p>
      <h2 className="try-cta-title">{heading} Get NoSwipe.</h2>
      <p>NoSwipe writes your profile, openers, replies and date plans, and you send everything yourself. Your accounts stay yours.</p>
      <Link
        href="/reserve?ref=try"
        className="btn btn-lime btn-block"
        onClick={() => {
          captureInternalLinkAttribution(`/reserve?ref=try&utm_source=try&utm_medium=tool&utm_campaign=${location}`);
          trackEvent("try_cta_click");
        }}
      >
        Get NoSwipe
      </Link>
      {typeof remaining === "number" && <small>{remaining > 0 ? `${remaining} free ${remaining === 1 ? "try" : "tries"} left today.` : "That was your last free try today."}</small>}
    </aside>
  );
}

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); } catch { /* nothing else to try */ }
      area.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1800);
  };
  return (
    <button type="button" className="try-copy" onClick={() => void copy()} data-done={done} aria-label={done ? "Copied" : `${label} text`}>
      {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : <Copy size={16} strokeWidth={2.5} aria-hidden="true" />}
      <span>{done ? "Copied" : label}</span>
    </button>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="try-block panel"><h2 className="try-block-title">{title}</h2>{children}</section>;
}

function Draft({ text, note }: { text: string; note?: string }) {
  return (
    <div className="try-draft">
      <p className="try-draft-text">{text}</p>
      {note && <p className="try-draft-note">{note}</p>}
      <CopyButton text={text} />
    </div>
  );
}

function Flags({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <section className="try-flags" aria-label="Check before you use this">
      <p className="try-flags-title">Check before you use this</p>
      <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    </section>
  );
}

const VERDICT: Record<string, string> = { lead: "Lead with this", keep: "Keep", cut: "Cut" };

function ResultView({ result, previews }: { result: PublicResult; previews: string[] }) {
  if (result.kind === "profile") {
    return (
      <>
        {result.photo_ranking.length > 0 && (
          <Block title="Your photos, best first">
            <ol className="try-rank">
              {result.photo_ranking.map((item, i) => (
                <li key={i} data-verdict={item.verdict}>
                  {previews[item.photo - 1] ? <img src={previews[item.photo - 1]} alt={`Photo ${item.photo}`} /> : <span className="try-rank-ph" aria-hidden="true" />}
                  <div><span className="try-badge" data-verdict={item.verdict}>{VERDICT[item.verdict] ?? item.verdict}</span><p>{item.reason}</p></div>
                </li>
              ))}
            </ol>
          </Block>
        )}
        {result.per_app.map((entry, i) => (
          <Block key={i} title={`${entry.app} bio and prompts`}>
            {entry.bio && <><p className="try-sub">Bio</p><Draft text={entry.bio} /></>}
            {entry.prompts.map((prompt, j) => (<div key={j}><p className="try-sub">{prompt.prompt}</p><Draft text={prompt.answer} /></div>))}
          </Block>
        ))}
        {result.settings_to_change.length > 0 && <Block title="Settings worth changing"><ul className="try-list">{result.settings_to_change.map((item, i) => <li key={i}>{item}</li>)}</ul></Block>}
        <Flags items={result.operator_flags} />
      </>
    );
  }
  if (result.kind === "opener") {
    return (
      <>
        <Block title="Three openers">
          {result.openers.map((opener, i) => <Draft key={i} text={opener.text} note={opener.references ? `Picks up on: ${opener.references}` : undefined} />)}
        </Block>
        <Flags items={result.operator_flags} />
      </>
    );
  }
  if (result.kind === "reply") {
    return (
      <>
        <Block title="Where the chat stands">
          <p className="try-read">{result.read} <span className="try-badge" data-warmth={result.warmth}>{result.warmth}</span></p>
          {result.respect_note && <p className="try-respect">{result.respect_note}</p>}
        </Block>
        {(result.reply || result.alternative) && (
          <Block title="Your reply options">
            {result.reply && <Draft text={result.reply} />}
            {result.alternative && <Draft text={result.alternative} note="Another way to say it" />}
          </Block>
        )}
        {result.ask_out_now && result.date_ask && <Block title="Looks open to meeting"><Draft text={result.date_ask} /></Block>}
        <Flags items={result.operator_flags} />
      </>
    );
  }
  return null;
}
