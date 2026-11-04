"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";

const TABLES = ["messages", "matches", "takeovers", "dates", "app_accounts"] as const;
const POLL_MS = 20_000;

/**
 * Keeps a server-rendered page fresh. Opens a Supabase Realtime channel with the user's own token
 * (RLS decides which rows stream; no column filter is needed) and calls router.refresh() when something changes. If Realtime
 * can't connect, it falls back to refreshing every 20 seconds. Returns whether the live channel is up.
 */
export function useLive(): boolean {
  const router = useRouter();
  // Keep the channel across refreshes: router identity can change on every refresh, which must not resubscribe.
  const routerRef = useRef(router);
  useEffect(() => { routerRef.current = router; });
  const [connected, setConnected] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let client: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let renew: ReturnType<typeof setInterval> | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    let token = "";

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => routerRef.current.refresh(), 150);
    };
    const startPolling = () => {
      if (!poll) poll = setInterval(() => { if (document.visibilityState === "visible") routerRef.current.refresh(); }, POLL_MS);
    };

    async function fetchToken() {
      const res = await fetch("/api/app/realtime", { cache: "no-store" });
      if (!res.ok) throw new Error("no token");
      return (await res.json()) as { url: string; key: string; token: string; userId: string };
    }

    (async () => {
      try {
        const info = await fetchToken();
        if (cancelled) return;
        token = info.token;
        client = createClient(info.url, info.key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          accessToken: async () => token
        });
        channel = client.channel(`live:${info.userId}`);
        for (const table of TABLES) {
          channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
        }
        channel.subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") { setConnected(true); if (poll) { clearInterval(poll); poll = null; } }
          else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") { setConnected(false); startPolling(); }
        });
        renew = setInterval(async () => {
          try { const next = await fetchToken(); token = next.token; await client?.realtime.setAuth(next.token); } catch { /* the next tick retries */ }
        }, 40 * 60_000);
      } catch {
        startPolling();
      }
    })();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      if (renew) clearInterval(renew);
      if (poll) clearInterval(poll);
      if (channel && client) void client.removeChannel(channel);
    };
  }, []);

  return connected;
}

/** Renders nothing; mounts the live connection for pages that have no other client code. */
export function Live() {
  useLive();
  return null;
}
