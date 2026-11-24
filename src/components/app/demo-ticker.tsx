"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Drives live demo mode from the open page: every ~10 s (while the tab is visible) it asks the server whether anything new happens and
 * refreshes the page when it did. Renders nothing. Mounted only for an internal account that has demo mode on, so it is invisible in
 * the client UI. The server holds the lock and the pacing, so extra tabs or slow networks never double an action.
 */
export function DemoTicker() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })();
    const schedule = (ms: number) => { if (!stopped) timer = setTimeout(tick, ms); };
    async function tick() {
      if (stopped) return;
      if (busy || document.visibilityState !== "visible") { schedule(4000); return; }
      busy = true;
      try {
        const res = await fetch("/api/app/demo/tick", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timezone }), cache: "no-store" });
        if (res.status === 404 || res.status === 401) { stopped = true; return; }
        const body = (await res.json()) as { changed?: boolean };
        if (body.changed) routerRef.current.refresh();
      } catch { /* the next tick retries */ } finally { busy = false; }
      schedule(8000 + Math.random() * 5000);
    }
    schedule(2500);
    const onVisible = () => { if (document.visibilityState === "visible" && !busy && !stopped) { if (timer) clearTimeout(timer); schedule(500); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, []);
  return null;
}
