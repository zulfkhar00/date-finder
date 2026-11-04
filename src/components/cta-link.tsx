"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { captureInternalLinkAttribution } from "@/lib/attribution-client";
import { track } from "@/lib/track";

/**
 * The one CTA: every "Get started" button goes through here so tracking has one hook. `utm` is a
 * campaign query string recorded on click; it stays out of the href so crawlers see one /onboarding URL
 * instead of a tagged copy per page.
 */
export function CtaLink({ href = "/onboarding", utm, location, className = "btn btn-primary", children }: { href?: string; utm?: string; location: string; className?: string; children?: ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => {
      captureInternalLinkAttribution(utm ? `${href}${href.includes("?") ? "&" : "?"}${utm}` : href);
      track("cta_click", { location });
    }}>
      {children ?? "Get started"}
    </Link>
  );
}
