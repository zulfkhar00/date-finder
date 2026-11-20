import Link from "next/link";
import { DocPage, docMetadata } from "@/components/doc-page";

export const metadata = docMetadata("/pricing", "Pricing", "NoSwipe pricing",
  "What NoSwipe charges today: a one-time, refundable $1.00 early-access payment, shown at checkout before you pay. No subscription, no other fees.");

export default function PricingPage() {
  return <DocPage heading="Pricing.">
    <p>NoSwipe is an AI dating assistant: it swipes, chats and schedules dates for you. This page states exactly what is charged today.</p>
    <h2>What you pay today</h2>
    <p><strong>One-time USD $1.00</strong> early-access payment. At checkout it is shown as &quot;noswipe — reserve early access: Refundable early-access waitlist fee. Does not start a service.&quot; You see the price before you pay.</p>
    <ul>
      <li>It is charged once through Stripe. It is not a subscription and does not renew.</li>
      <li>It is refundable to your original payment method; see the <Link href="/refunds">refund policy</Link>.</li>
      <li>It does not start the service, buy any number of matches or dates, or promise any result.</li>
    </ul>
    <h2>Nothing else is charged</h2>
    <p>There are no other plans, tiers, fees or hidden charges today. If we introduce a paid service, we show you its price and terms before you decide whether to join it.</p>
    <p className="policy-note">Last updated November 20, 2026. Questions? See <Link href="/contact">Contact</Link> or the <Link href="/terms">Terms</Link>.</p>
  </DocPage>;
}
