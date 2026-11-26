import Link from "next/link";
import { Brand } from "@/components/brand";
import { businessIdentity } from "@/lib/business";

export function SiteFooter() {
  const business = businessIdentity();
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
          <Link href="/hinge-openers-that-get-replies">Hinge openers</Link>
          <Link href="/dating-app-message-assistant">Message assistant</Link>
          <Link href="/hire-someone-to-do-my-dating-apps">Hire help for dating apps</Link>
          <Link href="/someone-to-run-my-dating-apps">Someone to run my dating apps</Link>
          <Link href="/dating-app-management-service">Dating app management</Link>
          <Link href="/tinder-done-for-you">Tinder done for you</Link>
          <Link href="/hinge-done-for-you">Hinge done for you</Link>
          <Link href="/bumble-done-for-you">Bumble done for you</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/acceptable-use">Acceptable use</Link>
          <Link href="/refunds">Refunds</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/report">Report a violation</Link>
          <Link href="/law-enforcement">Law enforcement</Link>
          <Link href="/#faq">FAQ</Link>
        </nav>
      </div>
      <p className="footer-small" style={{ marginTop: 18 }}>
        © {new Date().getFullYear()} NoSwipe. Not affiliated with Tinder, Hinge, Bumble or Badoo.
      </p>
      {business ? (
        <p className="footer-small">{[business.legalName, ...business.addressLines].join(", ")}</p>
      ) : null}
    </footer>
  );
}
