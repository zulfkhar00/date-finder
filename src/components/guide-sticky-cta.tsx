"use client";

import { useEffect, useState } from "react";
import { CtaLink } from "@/components/cta-link";
import { track as trackAnalytics } from "@/lib/analytics";

/**
 * Phone-only bottom bar for guide and answer pages. Shows once the reader is past the hero and
 * scrolling down; hides on scroll-up and whenever the closing CTA card or the footer is on screen,
 * so it never sits on top of the content it is next to. `inert` keeps it out of the tab order
 * while hidden. The click is a get_started funnel event (via CtaLink) plus a PostHog
 * sticky_cta_click carrying the page path.
 */
export function GuideStickyCta({ href, utm, slug }: { href: string; utm: string; slug: string }) {
  const [scrolledDown, setScrolledDown] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY;
        if (y < 480) setScrolledDown(false);
        else if (delta > 6) setScrolledDown(true);
        else if (delta < -6) setScrolledDown(false);
        if (Math.abs(delta) > 6) lastY = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const targets = [document.querySelector(".guide-cta"), document.querySelector(".site-footer")].filter((el): el is Element => el !== null);
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      setBlocked(visible.size > 0);
    });
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const show = scrolledDown && !blocked;
  return (
    <div
      className="sticky-cta guide-sticky"
      data-show={show}
      aria-hidden={!show}
      inert={!show}
      onClickCapture={() => trackAnalytics("sticky_cta_click", { props: { path: window.location.pathname, page: slug } })}
    >
      <CtaLink href={href} utm={utm} location={`sticky_guide_${slug}`} className="btn btn-lime btn-block" />
    </div>
  );
}
