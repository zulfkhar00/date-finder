"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { captureInternalLinkAttribution } from "@/lib/attribution-client";
import { track } from "@/lib/track";

/** The one CTA: every "Get started" button goes through here so tracking has one hook. */
export function CtaLink({ href = "/reserve", location, className = "btn btn-primary", children }: { href?: string; location: string; className?: string; children?: ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => {
      captureInternalLinkAttribution(href);
      track("cta_click", { location });
    }}>
      {children ?? "Get started"}
    </Link>
  );
}
