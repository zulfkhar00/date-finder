import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return <div className="interior"><SiteHeader /><main className="shell doc"><div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}><p className="kicker">The details</p><h1>Terms.</h1></div><p>NoSwipe sets up and runs your dating profiles and books dates for you. Getting started takes a one-time USD $1 payment at checkout, which reserves your spot and activates your setup.</p><h2>Your $1 payment</h2><p>The charge is a one-time USD $1 fee. It is not a subscription and not a payment for any number of matches or dates. Your spot is confirmed after our Stripe webhook verifies payment. We show you the price of anything else before you pay for it.</p><h2>No guarantees</h2><p>We do the work to get you dates, but we can’t guarantee a match, a date, or a start date for your setup.</p><h2>Refund policy</h2><p>The $1 is refundable. Reply to your confirmation email or write to support@noswipe.app and we refund it to your original payment method; your spot is then no longer reserved.</p><h2>Eligibility and contact</h2><p>You must be 18 or older to sign up. Keep your confirmation link private; it is used to view your payment status. For questions, email <a href="mailto:support@noswipe.app">support@noswipe.app</a>.</p><p className="policy-note">Last updated October 28, 2026. Please also read our <Link href="/privacy">privacy note</Link>.</p></main><SiteFooter /></div>;
}
