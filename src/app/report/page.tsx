import Link from "next/link";
import { DocPage, docMetadata } from "@/components/doc-page";
import { ReportForm } from "./report-form";

export const metadata = docMetadata("/report", "Report a violation", "Report a violation to NoSwipe",
  "Report a profile, message or photo that breaks the NoSwipe acceptable use policy: minor safety, trafficking, non-consensual images, threats, harassment, fraud or impersonation. Anonymous reports welcome.");

export default function ReportPage() {
  return <DocPage heading="Report a violation.">
    <p>Use this form to report a profile, message or photo that breaks our <Link href="/acceptable-use">Acceptable use policy</Link>. You do not need an account and you do not need to give your name or email.</p>
    <p><strong>We acknowledge every report within 24 hours and aim to resolve it within 72 hours.</strong> Reports about minors, trafficking, intimate images shared without consent, and threats are handled first, with a 4 hour target. People we act against can appeal, and a second review follows within 7 days.</p>
    <ReportForm />
  </DocPage>;
}
