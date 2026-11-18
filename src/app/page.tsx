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
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site}/#organization`,
    name: "NoSwipe",
    url: site,
    logo: `${site}/brand/email-logo.png`,
    email: "support@noswipe.app",
    description: "NoSwipe sets up profiles with your real photos and handles swiping, chats and date planning on Hinge, Tinder and Bumble using phones we operate."
  },
  { "@context": "https://schema.org", "@type": "WebSite", name: "NoSwipe", url: site },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "NoSwipe",
    url: site,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    publisher: { "@id": `${site}/#organization` },
    audience: { "@type": "Audience", audienceType: "Men who are done swiping on Tinder, Hinge and Bumble" },
    featureList: [
      "Swipes on Tinder, Hinge and Bumble for people who match the user's type and dealbreakers",
      "Opens and keeps up conversations in the user's own voice",
      "Books first dates and sends the user the plan: where, when, who",
      "Fixes the profile first: photo order, bio and prompt answers",
      "Profiles set up with the user's real photos, with in-app access to matches and chats"
    ],
    description: "Stop swiping. NoSwipe swipes, chats and books dates for you on Tinder, Hinge and Bumble. You just show up."
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
