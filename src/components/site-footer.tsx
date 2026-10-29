import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer shell">
      <div className="footer-row">
        <Brand />
        <nav className="footer-links" aria-label="Footer">
          <Link href="/guides">Guides</Link>
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
