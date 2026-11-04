"use client";

import { useSyncExternalStore } from "react";

type Style = "full" | "short" | "time" | "day" | "compact";
const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  full: { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  short: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
  day: { weekday: "long", month: "short", day: "numeric" },
  compact: { weekday: "short", hour: "numeric", minute: "2-digit" }
};

const subscribeNever = () => () => {};

/** A timestamp in the viewer's own time zone. Server render uses UTC; the browser swaps it on mount. */
export function When({ iso, style = "full" }: { iso: string; style?: Style }) {
  const fmt = (tz?: string) => new Date(iso).toLocaleString("en-US", { ...OPTIONS[style], ...(tz ? { timeZone: tz } : {}) });
  const raw = useSyncExternalStore(subscribeNever, () => fmt(), () => fmt("UTC"));
  // "Thu 7:00 pm": the compact style reads like a text message, not a timestamp.
  const text = style === "compact" ? raw.replace(",", "").replace(/ (AM|PM)$/, (m) => m.toLowerCase()) : raw;
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}
