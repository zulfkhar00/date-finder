import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
import { GuideBridge } from "@/components/guide-bridge";
import { GuideStickyCta } from "@/components/guide-sticky-cta";
import { FunnelTracker } from "@/components/funnel-tracker";
import { Acc, FaqItems, ShortHero } from "@/components/short/parts";
import { CopyCards } from "@/components/short/copy-cards";
import { HowSteps } from "@/components/short/how-steps";
import { promiseFor } from "@/content/promises";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getGuide, guideSlugs, guides, seoGuides } from "@/content/guides";
import { ogImages } from "@/lib/og";

type GuidePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return guideSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const url = `/guides/${guide.slug}`;
  return {
    title: guide.metaTitle ?? guide.title,
    description: guide.description,
    alternates: { canonical: url },
    openGraph: { images: ogImages, type: "article", siteName: "NoSwipe", title: guide.metaTitle ?? guide.title, description: guide.description, url, publishedTime: guide.publishedIso ?? "2026-10-29", authors: ["NoSwipe"] },
    twitter: { images: ogImages, card: "summary_large_image", title: guide.metaTitle ?? guide.title, description: guide.description }
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const canonicalUrl = `https://www.noswipe.app/guides/${guide.slug}`;
  const guidanceSources = guide.sources?.filter((source) => source.kind === "guidance") ?? [];
  // Hand-picked guides first, then the next two in list order, so every guide is linked from its neighbours.
  const position = guides.findIndex((item) => item.slug === guide.slug);
  const neighbours = [1, 2, 3].map((step) => guides[(position + step) % guides.length]);
  const picked = guide.relatedSlugs?.map((relatedSlug) => guides.find((item) => item.slug === relatedSlug)).filter((item) => item !== undefined) ?? [];
  const relatedGuides = [...picked, ...neighbours].filter((item, index, all) => item.slug !== guide.slug && all.findIndex((other) => other.slug === item.slug) === index).slice(0, Math.max(picked.length + 2, 3));
  const publishedIso = guide.publishedIso ?? "2026-10-29";
  const publishedLabel = new Date(`${publishedIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const isSeoGuide = seoGuides.some((item) => item.slug === guide.slug);
  const examples = guide.sections.flatMap((section) => (section.example ? [{ label: section.title, text: section.example.text }] : [])).slice(0, 6);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: guide.h1 ?? guide.title,
      description: guide.description,
      datePublished: publishedIso,
      dateModified: publishedIso,
      mainEntityOfPage: canonicalUrl,
      author: { "@type": "Organization", name: "NoSwipe", url: "https://www.noswipe.app" },
      publisher: { "@type": "Organization", name: "NoSwipe", url: "https://www.noswipe.app" },
      ...(guidanceSources.length ? { citation: guidanceSources.map((source) => source.url) } : {})
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "NoSwipe", item: "https://www.noswipe.app" },
        { "@type": "ListItem", position: 2, name: "Guides", item: "https://www.noswipe.app/guides" },
        { "@type": "ListItem", position: 3, name: guide.title, item: canonicalUrl }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: guide.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer }
      }))
    }
  ];

  const reserveHref = `/onboarding?ref=${guide.slug}`;
  const reserveUtm = isSeoGuide
    ? `utm_source=seo&utm_medium=guide&utm_campaign=${guide.slug}&utm_content=${guide.slug}`
    : `utm_source=organic&utm_medium=guide&utm_campaign=${guide.slug}&utm_content=guide-${guide.slug}-reserve`;

  return (
    <div className="interior">
      <FunnelTracker event="page_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader ctaHref={reserveHref} ctaUtm={reserveUtm} />
      <main>
        <article className="guide-article short-page">
          <ShortHero h1={guide.h1 ?? guide.title} promise={promiseFor(guide.slug)} href={reserveHref} utm={reserveUtm} location={`guide_${guide.slug}_hero`} />
          <HowSteps />
          <CopyCards items={examples} title="Copy a line" />

          <div className="shell short-more">
            <Acc title="The short version">
              <p>{guide.intro}</p>
              <p className="guide-meta">Published {publishedLabel} · {guide.readingTime}</p>
            </Acc>
            <GuideBridge href={reserveHref} utm={reserveUtm} location={`guide_${guide.slug}_bridge`} />
            {guide.sections.map((section, index) => (
              <Acc key={section.title} title={section.title} id={`section-${index + 1}`}>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? (
                  <ul>
                    {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                  </ul>
                ) : null}
                {section.example ? (
                  <aside className="guide-example">
                    <strong>{section.example.label}</strong>
                    <p>{section.example.text}</p>
                  </aside>
                ) : null}
              </Acc>
            ))}

            <Acc title="Your checklist" id="review-checklist">
              <ul className="acc-checks">
                {guide.checklist.map((item) => (
                  <li key={item}><span className="check-dot"><Check size={14} aria-hidden="true" /></span>{item}</li>
                ))}
              </ul>
            </Acc>

            <Acc title="FAQ" id="guide-faq-title" className="guide-faq">
              <FaqItems faqs={guide.faqs} />
            </Acc>

            {guide.sources ? (
              <Acc title="Sources and platform context" className="guide-sources">
                <p>
                  Examples and checklists are NoSwipe editorial guidance. Supporting guidance informs specific advice; platform and background links provide context, not evidence for every framework.
                </p>
                <ul>
                  {guide.sources.map((source) => (
                    <li key={source.url}>
                      <a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                      {" — "}{source.kind === "guidance" ? "Supporting guidance" : source.kind === "platform-context" ? "Platform context" : "Background context"}
                    </li>
                  ))}
                </ul>
              </Acc>
            ) : null}

            <aside className="guide-cta" aria-labelledby="guide-cta-title">
              <h2 id="guide-cta-title">Rather skip the swiping?</h2>
              <p>NoSwipe swipes, chats and books dates for you.</p>
              <CtaLink href={reserveHref} utm={reserveUtm} location={`guide_${guide.slug}`} className="btn btn-lime">
                Get started
              </CtaLink>
            </aside>
          </div>

          <nav className="shell related-guides" aria-label="Related guides">
            <p className="kicker">Keep reading</p>
            <div>
              {relatedGuides.map((item) => (
                <Link href={`/guides/${item.slug}`} key={item.slug}>{item.title}</Link>
              ))}
            </div>
          </nav>
        </article>
      </main>
      <GuideStickyCta href={reserveHref} utm={reserveUtm} slug={guide.slug} />
      <SiteFooter />
    </div>
  );
}
