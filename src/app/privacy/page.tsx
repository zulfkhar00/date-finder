import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = { title: "Privacy note" };

export default function PrivacyPage() {
  return <div className="interior"><SiteHeader /><main className="shell doc"><div className="page-head" style={{ paddingLeft: 0, paddingRight: 0 }}><p className="kicker">The details</p><h1>Privacy note.</h1></div><p>This note explains how the NoSwipe early-access waitlist works. A reservation does not activate concierge service.</p><h2>What we collect</h2><p>We collect your email, city, dating preferences, relationship goal, desired date frequency, and confirmation that you are 18 or older. We also record when you accept the reservation terms, your Stripe Checkout reference, payment status, and waitlist position after a successful payment.</p><h2>Why we collect it</h2><p>We use this information to manage the waitlist, understand where interest exists, and contact you if concierge access becomes available. Your questionnaire answers are stored privately and are not shown to other visitors.</p><h2>Payment information</h2><p>Checkout is hosted by Stripe. We do not receive or store your full card number. Stripe processes the $1 payment and any refund required by law or issued by us.</p><h2>Questions and changes</h2><p>For payment questions or requests to correct or remove waitlist information, use the support contact shown on your Stripe receipt.</p><p className="policy-note">Last updated October 23, 2026. This plain-language note describes the early-access reservation; separate service terms will be provided before you decide whether to join the concierge.</p></main><SiteFooter /></div>;
}
