import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SiteHeader({ dark = false }: { dark?: boolean }) {
  return (
    <header className={`site-header ${dark ? "site-header-dark" : ""}`}>
      <Link href="/" className="wordmark" aria-label="Morrow home">morrow<span>.</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <Link href="/#how">The idea</Link>
        <Link href="/#experience">The experience</Link>
        <Link href="/#pricing">Early access</Link>
      </nav>
      <Link href="/reserve" className="nav-reserve">Reserve your place <ArrowUpRight size={16} strokeWidth={1.5} /></Link>
    </header>
  );
}
