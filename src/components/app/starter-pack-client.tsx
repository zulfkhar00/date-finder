"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { regeneratePack } from "@/lib/starter-pack/actions";

// Client pieces of the starter pack: copy buttons (with a manual-select fallback), the poller that refreshes the
// page while the pack is being written, and the Regenerate button. Nothing here logs or sends the pack anywhere.

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the legacy path */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Copies one line. If the browser refuses (some in-app browsers do), the text is shown selected so a long-press copies it. */
export function CopyButton({ text, label = "Copy", onCopied }: { text: string; label?: string; onCopied?: () => void }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (state === "manual") { area.current?.focus(); area.current?.select(); } }, [state]);
  async function copy() {
    const ok = await writeClipboard(text);
    setState(ok ? "copied" : "manual");
    if (ok) onCopied?.();
    if (timer.current) clearTimeout(timer.current);
    if (ok) timer.current = setTimeout(() => setState("idle"), 1800);
  }
  return (
    <>
      <button type="button" className="app-btn ghost small sp-copy" onClick={copy} aria-label={`${label}: ${text.slice(0, 40)}`}>
        {state === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
        <span aria-live="polite">{state === "copied" ? "Copied" : label}</span>
      </button>
      {state === "manual" ? (
        <div className="sp-manual">
          <p>Your browser blocked copying. Select this text and copy it.</p>
          <textarea ref={area} readOnly value={text} rows={Math.min(6, Math.ceil(text.length / 38) + 1)} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="app-link" onClick={() => setState("idle")}>Done</button>
        </div>
      ) : null}
    </>
  );
}

/** Refreshes the page every few seconds while the pack is being written, for about three minutes, then stops. */
export function PackPoller({ intervalMs = 5000, maxTicks = 36 }: { intervalMs?: number; maxTicks?: number }) {
  const router = useRouter();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    let ticks = 0;
    const id = setInterval(() => {
      ticks += 1;
      if (ticks >= maxTicks) { clearInterval(id); setSlow(true); return; }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, maxTicks]);
  return slow ? <p className="app-muted sp-note" role="status">This is taking longer than usual. It keeps going in the background; check back later.</p> : null;
}

export function RegenerateButton({ left, label = "Write it again" }: { left: number; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const none = left <= 0;
  function run() {
    if (pending || none) return;
    setError(null);
    start(async () => {
      try {
        const result = await regeneratePack();
        if (!result.ok) setError(result.error);
        else router.refresh();
      } catch {
        setError("Couldn't reach the server. Check your connection and try again.");
      }
    });
  }
  return (
    <div className="sp-regen">
      <button type="button" className="app-btn ghost small" onClick={run} disabled={pending || none} aria-busy={pending}>
        {pending ? <span className="app-spinner" aria-hidden /> : null}{pending ? "Starting" : label}
      </button>
      <span className="app-muted">{none ? "No refreshes left today." : `${left} left today`}</span>
      {error ? <p role="alert" className="sp-error">{error}</p> : null}
    </div>
  );
}
