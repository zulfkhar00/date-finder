"use client";

import { useEffect } from "react";
import { Globe2 } from "lucide-react";
import { trackEvent } from "@/lib/attribution-client";
import { COUNTRY_BLOCKED_COPY } from "@/lib/paid-countries";

/**
 * Shown instead of a payment form when the visitor's country is outside PAID_COUNTRIES. No form, no price, no button
 * to pay. Sign-up and the free starter pack are untouched. Counts once per tab session (checkout_blocked_country).
 */
export function CountryBlocked({ className = "app-card" }: { className?: string }) {
  useEffect(() => { trackEvent("checkout_blocked_country", { oncePerSession: true }); }, []);
  return (
    <section className={className} role="status" aria-live="polite" data-testid="country-blocked">
      <Globe2 size={22} aria-hidden />
      <p style={{ marginTop: 8, fontWeight: 700 }}>{COUNTRY_BLOCKED_COPY}</p>
    </section>
  );
}
