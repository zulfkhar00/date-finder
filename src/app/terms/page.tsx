import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ogImages } from "@/lib/og";

const description = "Terms for the refundable $1 NoSwipe early-access reservation and screenshot-based dating concierge drafts.";

export const metadata: Metadata = {
  title: "Terms",
  description,
  alternates: { canonical: "/terms" },
  openGraph: { images: ogImages, title: "NoSwipe terms", description, url: "/terms" },
  twitter: { images: ogImages, title: "NoSwipe terms", description }
};

export default function TermsPage() {
  return <div className="interior">
    <SiteHeader />
    <main className="shell doc">
      <div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}>
        <p className="kicker">The details</p>
        <h1>Terms.</h1>
      </div>
      <p>NoSwipe is a screenshot-based dating concierge. If access opens for you, we can review the context you choose to share and prepare profile copy, message drafts and date plans. You keep control of your dating-app accounts and decide what to use.</p>
      <h2>Your $1 payment</h2>
      <p>The one-time USD $1 charge is a refundable early-access waitlist fee. It reserves a spot on the list; it does not start concierge service, buy any number of matches or dates, or authorize NoSwipe to access a dating-app account. Your spot is confirmed after our Stripe webhook verifies payment. We show you the price and separate terms for any future paid service before you decide whether to join it.</p>
      <h2>Your accounts and messages</h2>
      <p>You keep every dating-app account. NoSwipe does not log in, swipe, like profiles, send messages or confirm dates for you. Any profile text, opener, reply or date plan we provide is a draft: you review and edit it, choose who to like, send every message and confirm every date yourself.</p>
      <h2>No guarantees</h2>
      <p>Advice and drafts cannot guarantee a match, reply, date or relationship. Early-access payment also does not guarantee when or whether a concierge place will open.</p>
      <h2>Refund policy</h2>
      <p>The $1 is refundable. Reply to your confirmation email or write to support@noswipe.app and we refund it to your original payment method; your spot is then no longer reserved.</p>
      <h2>Eligibility and contact</h2>
      <p>You must be 18 or older to sign up. Keep your confirmation link private; it is used to view your payment status. For questions, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p>
      <p className="policy-note">Last updated October 29, 2026. Please also read our <Link href="/privacy">privacy note</Link>.</p>
    </main>
    <SiteFooter />
  </div>;
}
