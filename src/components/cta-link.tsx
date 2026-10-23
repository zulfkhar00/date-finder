"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { track } from "@/lib/track";

/** The one CTA: every "$1 — get on the list" button goes through here so tracking has one hook. */
export function CtaLink({ location, className = "btn btn-primary", children }: { location: string; className?: string; children?: ReactNode }) {
  return (
    <Link href="/reserve" className={className} onClick={() => track("cta_click", { location })}>
      {children ?? "$1 — get on the list"}
    </Link>
  );
}
