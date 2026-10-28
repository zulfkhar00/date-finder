"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/attribution-client";
import type { ClientEventName } from "@/lib/attribution";

/** Fires one funnel event when mounted. Renders nothing. */
export function FunnelTracker({ event, oncePerSession = false }: { event: ClientEventName; oncePerSession?: boolean }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, { oncePerSession });
  }, [event, oncePerSession]);
  return null;
}
