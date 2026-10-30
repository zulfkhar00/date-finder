import type { Metadata } from "next";
import { FunnelTracker } from "@/components/funnel-tracker";
import { LandingPage } from "@/components/landing-page";
import { faqs } from "@/content/faq";

// Re-render at most once a minute so the founding-members count stays fresh without a
// database query on every visit.
export const revalidate = 60;

export const metadata: Metadata = { alternates: { canonical: "/" } };

const site = "https://www.noswipe.app";
const structuredData = [
  { "@context": "https://schema.org", "@type": "Organization", name: "NoSwipe", url: site, email: "support@noswipe.app" },
  { "@context": "https://schema.org", "@type": "WebSite", name: "NoSwipe", url: site },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NoSwipe",
    url: site,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    description: "Screenshot-based help for dating profiles, openers, replies and first-date plans. You keep every account and send every message yourself."
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } }))
  }
];

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <FunnelTracker event="page_view" />
      <LandingPage />
    </>
  );
}
