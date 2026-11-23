import { CtaLink } from "@/components/cta-link";

/**
 * Right under the first answer of a guide or answer page: one line that says what NoSwipe is, and the button.
 * Readers arrive for advice (43 desktop guide sessions, 0 starts in 14 days); until now the only product mention was
 * a card after the FAQ and a bare "Get started" in the hero.
 */
export function GuideBridge({ href, utm, location }: { href: string; utm: string; location: string }) {
  return (
    <aside className="guide-bridge" aria-label="About NoSwipe">
      <p><strong>Rather not do this yourself?</strong> We create your dating profiles and run them for you. You just show up.</p>
      <CtaLink href={href} utm={utm} location={location} className="btn btn-primary" />
    </aside>
  );
}
