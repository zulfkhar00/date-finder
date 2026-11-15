import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer shell">
      <div className="footer-row">
        <Brand />
        <nav className="footer-links" aria-label="Footer">
          <Link href="/guides">Guides</Link>
          <Link href="/ai-dating-assistant">AI dating assistant</Link>
          <Link href="/dating-app-concierge">Dating concierge</Link>
          <Link href="/is-there-an-ai-that-does-dating-apps-for-you">Does AI do dating apps?</Link>
          <Link href="/ai-dating-concierge-vs-matchmaker">Concierge vs matchmaker</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
      </div>
      <p className="footer-small" style={{ marginTop: 18 }}>
        © {new Date().getFullYear()} NoSwipe. Not affiliated with Tinder, Hinge, Bumble or Badoo.
      </p>
    </footer>
  );
}
