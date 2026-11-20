import Link from "next/link";
import { DocPage, SUPPORT_EMAIL, docMetadata } from "@/components/doc-page";

export const metadata = docMetadata("/refunds", "Refund policy", "NoSwipe refund policy",
  "NoSwipe's one-time $1 early-access payment is refundable. Email support to get it back on your original payment method.");

export default function RefundsPage() {
  return <DocPage heading="Refund policy.">
    <p>Today, the only thing NoSwipe charges for is a one-time USD $1.00 early-access payment. At checkout it is described as a &quot;Refundable early-access waitlist fee. Does not start a service.&quot; This page says how to get that $1 back. See <Link href="/pricing">Pricing</Link> for what is charged.</p>
    <h2>What is refundable</h2>
    <p>The $1.00 early-access payment is refundable. It does not start the service, buy any number of matches or dates, or change how your profile is run. If you are refunded, your early-access spot is no longer reserved.</p>
    <h2>How to ask for a refund</h2>
    <p>Reply to your confirmation email, or write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the email address you paid with. Tell us you want a refund; you do not need to give a reason.</p>
    <h2>How long it takes</h2>
    <p>We reply within 2 business days. We refund to the original payment method through Stripe. After we issue it, how soon it appears depends on your bank or card issuer, and usually takes several business days.</p>
    <h2>Other charges</h2>
    <p>NoSwipe has no other charges today. If we ever offer a paid service, we show you the price and its separate terms, including refund terms, before you decide to join it.</p>
    <h2>Closing your account</h2>
    <p>You can delete your account in Profile at any time. That does not by itself refund a payment; email us to ask for the refund.</p>
    <p className="policy-note">Last updated November 20, 2026. See also our <Link href="/terms">Terms</Link> and <Link href="/contact">Contact</Link>.</p>
  </DocPage>;
}
