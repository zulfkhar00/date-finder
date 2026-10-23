"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/attribution-client";

/** Fires one funnel event when mounted. Renders nothing. */
export function FunnelTracker({ event, oncePerSession = false }: { event: "page_view" | "reserve_start" | "checkout_canceled"; oncePerSession?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, { oncePerSession });
  }, [event, oncePerSession]);
  return null;
}
