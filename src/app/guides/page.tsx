import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FunnelTracker } from "@/components/funnel-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { aiPages } from "@/content/ai-pages";
import { guides } from "@/content/guides";
import { ogImages } from "@/lib/og";

const title = "Practical dating-app profile, match and message guides";
const description =
  "NoSwipe editorial guides for Tinder, Bumble and Hinge profiles, photo order, prompts, first messages and asking someone out, with source and platform context.";

export const metadata: Metadata = {
  title: "Dating profile and message guides",
  description,
  alternates: { canonical: "/guides" },
  openGraph: { images: ogImages, title, description, url: "/guides" },
  twitter: { images: ogImages, title, description }
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
      url: `https://www.noswipe.app/guides/${guide.slug}`
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
            NoSwipe editorial reviews, examples and checklists for Tinder, Bumble and Hinge, with supporting guidance and clearly labeled platform context. No guaranteed-match claims, copied pickup lines or fake success stories.
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

        <nav className="shell related-guides" aria-label="Quick answers">
          <p className="kicker">Quick answers</p>
          <div>
            {aiPages.map((page) => <Link href={page.path} key={page.path}>{page.h1}</Link>)}
          </div>
        </nav>

        <section className="shell guide-principle" aria-labelledby="guide-principle-title">
          <p className="kicker">How NoSwipe works</p>
          <h2 id="guide-principle-title">We swipe. You date.</h2>
          <p>
            NoSwipe fixes your profile, swipes on people who fit, keeps the chats going in your voice and books the first date on Tinder, Hinge and Bumble.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
