"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "@/lib/app/match-profile";

const subscribe = (notify: () => void) => { const id = setInterval(notify, 30_000); return () => clearInterval(id); };
// One snapshot per half minute, so the label ticks over while the page stays open without re-rendering on every frame.
const minuteSnapshot = () => Math.floor(Date.now() / 30_000) * 30_000;

/** "3 h ago" for a timestamp, kept current while the page is open. */
export function Ago({ iso, prefix = "" }: { iso: string; prefix?: string }) {
  const now = useSyncExternalStore(subscribe, minuteSnapshot, minuteSnapshot);
  return <time className="app-ago" dateTime={iso} suppressHydrationWarning>{prefix}{timeAgo(Date.parse(iso), now)}</time>;
}
