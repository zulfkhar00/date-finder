import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: true } };

export default function NotFound() {
  return (
    <div className="interior">
      <SiteHeader showCta={false} />
      <main>
        <header className="page-head shell guide-index-head">
          <p className="kicker">404</p>
          <h1>That page isn&apos;t here.</h1>
          <p>The link may be old or mistyped. These are good places to start.</p>
        </header>
        <nav className="shell related-guides" aria-label="Where to go next">
          <div>
            <Link href="/">NoSwipe home</Link>
            <Link href="/ai-dating-assistant">What is an AI dating assistant?</Link>
            <Link href="/guides">Dating guides</Link>
            <Link href="/demo">See the app</Link>
          </div>
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
