import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Reservation terms" };

export default function TermsPage() {
  return <div className="interior"><SiteHeader /><main className="shell doc"><div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}><p className="kicker">The details</p><h1>Reservation terms.</h1></div><p>NoSwipe is accepting paid reservations for an early-access queue. Concierge access is offered separately as availability opens.</p><h2>Your $1 reservation</h2><p>The charge is a one-time USD $1 fee to reserve a place in the queue. It is not a subscription, deposit toward concierge service, or payment for an introduction or date. Your place in the queue is confirmed after our Stripe webhook verifies payment.</p><h2>What the queue means</h2><p>A place in the queue does not guarantee an invitation, service availability in your city, an invitation date, an introduction, a match, or any number of dates. We may open access gradually based on capacity and geography. We will share concierge pricing before asking you to join.</p><h2>Refund policy</h2><p>The $1 reservation fee is nonrefundable, except where required by law. If a refund is required or we choose to issue one, it goes to the original payment method and your place in the queue is no longer active.</p><h2>Eligibility and contact</h2><p>You must be 18 or older to reserve. Keep your confirmation link private; it is used to view your reservation status. For questions, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p><p className="policy-note">Last updated October 23, 2026. Please also read our <Link href="/privacy">privacy note</Link>.</p></main><SiteFooter /></div>;
}
