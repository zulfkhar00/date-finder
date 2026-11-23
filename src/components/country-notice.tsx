"use client";

import { useEffect, useState } from "react";
import { Globe2 } from "lucide-react";
import { trackEvent } from "@/lib/attribution-client";
import { COUNTRY_BLOCKED_COPY } from "@/lib/paid-countries";

/**
 * Landing and guide pages are cached, so the country is checked after load (/api/paid-access). Renders nothing for
 * supported countries, admins and on any error. `show` skips the fetch when the server already knows (onboarding).
 * Counts once per tab session as checkout_blocked_country.
 */
export function CountryNotice({ className = "country-notice", show }: { className?: string; show?: boolean }) {
  const [blocked, setBlocked] = useState(show ?? false);
  useEffect(() => {
    if (show !== undefined) return;
    const controller = new AbortController();
    fetch("/api/paid-access", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { available?: boolean } | null) => { if (data && data.available === false) setBlocked(true); })
      .catch(() => {});
    return () => controller.abort();
  }, [show]);
  useEffect(() => { if (blocked) trackEvent("checkout_blocked_country", { oncePerSession: true }); }, [blocked]);
  if (!blocked) return null;
  return (
    <p className={className} role="status" data-testid="country-notice">
      <Globe2 size={18} aria-hidden />
      <span>{COUNTRY_BLOCKED_COPY}</span>
    </p>
  );
}
