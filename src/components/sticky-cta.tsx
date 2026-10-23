"use client";

import { useEffect, useState } from "react";
import { CtaLink } from "@/components/cta-link";

/** Phone-only bottom CTA. Appears once the hero CTA has scrolled away; `inert` keeps it out of the tab order while hidden. */
export function StickyCta({ watchId }: { watchId: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watchId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setShow(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [watchId]);
  return (
    <div className="sticky-cta" data-show={show} aria-hidden={!show} inert={!show}>
      <CtaLink location="sticky_mobile" className="btn btn-primary btn-block" />
    </div>
  );
}
