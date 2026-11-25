import Link from "next/link";
import { DocPage, SUPPORT_EMAIL, docMetadata } from "@/components/doc-page";
import { businessIdentity } from "@/lib/business";

export const metadata = docMetadata("/contact", "Contact", "Contact NoSwipe",
  "Contact NoSwipe support by email for account help, refunds and privacy requests, or use the report form for safety reports. We reply within 2 business days; safety reports are acknowledged within 24 hours.");

export default function ContactPage() {
  const business = businessIdentity();
  return <DocPage heading="Contact.">
    <p>Email us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We reply within 2 business days.</p>
    {business ? <>
      <h2>Business details</h2>
      <p>{business.legalName}{business.addressLines.map((line) => <span key={line}><br />{line}</span>)}</p>
    </> : null}
    <h2>What to contact us about</h2>
    <ul>
      <li>Help with your account, your profiles or a chat.</li>
      <li>A refund of your $1.00 early-access payment; see the <Link href="/refunds">refund policy</Link>.</li>
      <li>Questions about <Link href="/pricing">pricing</Link>.</li>
      <li>Privacy requests: access, correction or deletion of your information; see the <Link href="/privacy">privacy note</Link>.</li>
    </ul>
    <h2>Report a violation</h2>
    <p>To report trafficking, exploitation, a minor, intimate images shared without consent, threats, harassment, fraud or impersonation, use the <Link href="/report">report form</Link>. You do not need an account and you can stay anonymous. We acknowledge every report within 24 hours and aim to resolve it within 72 hours; urgent reports are handled first, with a 4 hour target. If we act against an account, its owner can appeal within 14 days and we review the appeal within 7 days. If someone is in immediate danger, call your local emergency number first.</p>
    <h2>Authorities</h2>
    <p>Law enforcement and government agencies, please follow our <Link href="/law-enforcement">law enforcement protocol</Link>. If someone is in immediate danger, call your local emergency number first.</p>
    <p className="policy-note">Please do not send passwords or sign-in codes by email; we never ask for them.</p>
  </DocPage>;
}
