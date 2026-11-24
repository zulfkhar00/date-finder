import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { CountryNotice } from "@/components/country-notice";
import { CtaLink } from "@/components/cta-link";
import type { CopyItem } from "@/components/short/copy-cards";

/** Above the fold on a phone: the headline, one short line and the one button. Nothing else. */
export function ShortHero({ h1, promise, href, utm, location }: { h1: string; promise: string; href: string; utm: string; location: string }) {
  return (
    <header className="short-hero shell">
      <h1>{h1}</h1>
      <p className="short-promise">{promise}</p>
      <CtaLink href={href} utm={utm} location={location} className="btn btn-primary btn-block short-cta" />
      <CountryNotice />
    </header>
  );
}

/**
 * Collapsed by default, but the text is in the server-rendered HTML (native <details>), so search
 * engines and AI crawlers read it and no JavaScript is needed to open it.
 */
export function Acc({ title, children, id, className = "" }: { title: string; children: ReactNode; id?: string; className?: string }) {
  return (
    <details className={`acc ${className}`.trim()} id={id}>
      <summary>
        <h2>{title}</h2>
        <ChevronDown size={22} strokeWidth={2.6} aria-hidden="true" />
      </summary>
      <div className="acc-body">{children}</div>
    </details>
  );
}

/** FAQ entries as nested collapsed items inside one accordion. */
export function FaqItems({ faqs }: { faqs: { question: string; answer: string }[] }) {
  return (
    <div className="faq-mini">
      {faqs.map((faq) => (
        <details key={faq.question}>
          <summary><h3>{faq.question}</h3><ChevronDown size={18} strokeWidth={2.6} aria-hidden="true" /></summary>
          <p>{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}

/** Pulls quoted sample lines ("Label: “line”") out of bullet lists so they can become copy cards. */
export function quotedBullets(bullets: string[] | undefined): CopyItem[] {
  const out: CopyItem[] = [];
  for (const bullet of bullets ?? []) {
    const m = bullet.match(/^(.{0,90}?):\s*[“"]([^”"]{25,})[”"]\.?$/);
    if (m) out.push({ label: m[1].trim(), text: m[2].trim() });
  }
  return out;
}
