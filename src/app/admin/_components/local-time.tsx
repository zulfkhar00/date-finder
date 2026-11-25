"use client";

import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};
const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short" };

/** Timestamps are stored in UTC. The server render shows UTC; the browser swaps in the admin's own time zone (UTC on hover). */
export function LocalTime({ iso }: { iso: string | null | undefined }) {
  const date = iso ? new Date(iso) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const text = useSyncExternalStore(
    subscribeNever,
    () => (valid ? date.toLocaleString("en-GB", opts) : "—"),
    () => (valid ? date.toLocaleString("en-GB", { ...opts, timeZone: "UTC" }) : "—")
  );
  if (!valid) return <>—</>;
  return <time dateTime={date.toISOString()} title={`${date.toISOString().replace("T", " ").slice(0, 16)} UTC`} suppressHydrationWarning>{text}</time>;
}
