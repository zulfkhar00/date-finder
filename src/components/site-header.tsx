import Link from "next/link";
import { Brand } from "@/components/brand";
import { CtaLink } from "@/components/cta-link";

export function SiteHeader({ showCta = true }: { showCta?: boolean }) {
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Brand />
        <nav className="nav" aria-label="Main navigation">
          <Link href="/#get">What you get</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
        {showCta ? <CtaLink location="header" className="btn btn-primary btn-small" /> : <span />}
      </div>
    </header>
  );
}
