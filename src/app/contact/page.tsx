import Link from "next/link";
import { DocPage, SUPPORT_EMAIL, docMetadata } from "@/components/doc-page";

export const metadata = docMetadata("/contact", "Contact", "Contact NoSwipe",
  "Contact NoSwipe support by email for account help, refunds, privacy requests and safety reports. We reply within 2 business days.");

export default function ContactPage() {
  return <DocPage heading="Contact.">
    <p>Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We reply within 2 business days.</p>
    <h2>What to contact us about</h2>
    <ul>
      <li>Help with your account, your profiles or a chat.</li>
      <li>A refund of your $1.00 early-access payment; see the <Link href="/refunds">refund policy</Link>.</li>
      <li>Questions about <Link href="/pricing">pricing</Link>.</li>
      <li>Privacy requests: access, correction or deletion of your information; see the <Link href="/privacy">privacy note</Link>.</li>
      <li>Reporting a violation of our <Link href="/acceptable-use">Acceptable use policy</Link>, such as trafficking, exploitation, harassment, fraud or impersonation.</li>
    </ul>
    <h2>Authorities</h2>
    <p>Law enforcement and government agencies, please follow our <Link href="/law-enforcement">law enforcement protocol</Link>. If someone is in immediate danger, call your local emergency number first.</p>
    <p className="policy-note">Please do not send passwords or sign-in codes by email; we never ask for them.</p>
  </DocPage>;
}
