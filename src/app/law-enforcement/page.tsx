import Link from "next/link";
import { DocPage, SUPPORT_EMAIL, docMetadata } from "@/components/doc-page";

export const metadata = docMetadata("/law-enforcement", "Law enforcement protocol", "NoSwipe law enforcement protocol",
  "How authorities can request information from NoSwipe: valid legal process by email, emergency disclosure, child safety reports to NCMEC, preservation requests and user notice.");

export default function LawEnforcementPage() {
  return <DocPage heading="Law enforcement protocol.">
    <p>NoSwipe takes safety seriously and works with authorities. This page explains how to ask us for information. It is for law enforcement and government agencies; if you are a user with a question, see <Link href="/contact">Contact</Link>.</p>
    <h2>How to send a request</h2>
    <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from an official government email address with the subject &quot;Law enforcement request&quot;. Include your name, agency, badge or ID number, a way to reach you, the account or email address concerned, the information you need, and the legal process that supports it.</p>
    <h2>Legal process required</h2>
    <p>We disclose user information only in response to valid legal process, such as a subpoena, court order or search warrant, issued under the law that applies to us, or where the law otherwise requires it. We review each request and may push back on, narrow or reject requests that are overbroad, unclear or invalid.</p>
    <h2>Emergency requests</h2>
    <p>If someone is at risk of death or serious physical harm, say &quot;Emergency&quot; in the subject line. We can disclose information without legal process when we have a good-faith belief that it is needed to prevent that harm, and we review emergency requests as a priority.</p>
    <h2>Child safety</h2>
    <p>We prohibit any sexual content involving minors. We report apparent child sexual exploitation to the National Center for Missing &amp; Exploited Children (NCMEC), as US law requires, and cooperate with follow-up requests.</p>
    <h2>Reporting a violation</h2>
    <p>Members of the public can report a profile, message or photo through our <Link href="/report">report form</Link>, anonymously if they prefer. Authorities should still use the email process above.</p>
    <h2>Preservation requests</h2>
    <p>On a written request from law enforcement, we will preserve the information we hold on an account while you obtain legal process. Tell us the account and the period to preserve.</p>
    <h2>Notice to users</h2>
    <p>We notify the user of a request for their information before disclosure, unless we are prohibited by law or court order, or we believe notice would endanger a person or put an investigation at risk, for example in cases involving child safety or an emergency.</p>
    <h2>What we hold</h2>
    <p>Depending on the account: profile details, photos, matches, messages sent and received through the service, consent record and payment records. See the <Link href="/privacy">privacy note</Link>. Data kept by Tinder, Hinge or Bumble is held by those companies; requests for it go to them.</p>
    <p className="policy-note">Last updated November 20, 2026. See also our <Link href="/acceptable-use">Acceptable use policy</Link> and <Link href="/terms">Terms</Link>.</p>
  </DocPage>;
}
