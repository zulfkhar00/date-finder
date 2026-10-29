import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FunnelTracker } from "@/components/funnel-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { guides } from "@/content/guides";

const title = "Practical dating profile, message and date guides";
const description =
  "Clear, honest guides for reviewing dating profiles, writing Hinge prompts, improving messages and planning a first date.";

export const metadata: Metadata = {
  title: "Dating profile and message guides",
  description,
  alternates: { canonical: "/guides" },
  openGraph: { title, description, url: "/guides" },
  twitter: { title, description }
};

export default function GuidesPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "NoSwipe dating guides",
    itemListElement: guides.map((guide, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: guide.title,
      url: `https://noswipe.app/guides/${guide.slug}`
    }))
  };

  return (
    <div className="interior">
      <FunnelTracker event="page_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList).replace(/</g, "\\u003c") }}
      />
      <SiteHeader showCta={false} />
      <main>
        <header className="page-head shell guide-index-head">
          <p className="kicker">NoSwipe guides</p>
          <h1>Dating advice you can actually use.</h1>
          <p>
            Practical reviews, examples and checklists. No guaranteed-match claims, copied pickup lines or fake success stories.
          </p>
        </header>

        <section className="shell guide-grid" aria-label="Dating guides">
          {guides.map((guide, index) => (
            <article className="guide-card" key={guide.slug}>
              <span className="guide-card-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <p className="kicker">{guide.eyebrow}</p>
              <h2>{guide.title}</h2>
              <p>{guide.description}</p>
              <Link href={`/guides/${guide.slug}`} className="guide-card-link">
                Read the guide <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </section>

        <section className="shell guide-principle" aria-labelledby="guide-principle-title">
          <p className="kicker">How NoSwipe works</p>
          <h2 id="guide-principle-title">Screenshots in. Drafts out. You stay in control.</h2>
          <p>
            NoSwipe can rank photos, draft profile copy and messages, and help plan a date from the context you choose to share. We do not log in, swipe or send for you.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
