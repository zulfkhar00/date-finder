import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { notFound } from "next/navigation";
import { CtaLink } from "@/components/cta-link";
import { FunnelTracker } from "@/components/funnel-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getGuide, guideSlugs, guides, seoGuides } from "@/content/guides";

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
    openGraph: { type: "article", siteName: "NoSwipe", title: guide.metaTitle ?? guide.title, description: guide.description, url, publishedTime: guide.publishedIso ?? "2026-10-29", authors: ["NoSwipe"] },
    twitter: { card: "summary_large_image", title: guide.metaTitle ?? guide.title, description: guide.description }
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const canonicalUrl = `https://www.noswipe.app/guides/${guide.slug}`;
  const guidanceSources = guide.sources?.filter((source) => source.kind === "guidance") ?? [];
  const relatedGuides = guide.relatedSlugs
    ? guide.relatedSlugs.map((relatedSlug) => guides.find((item) => item.slug === relatedSlug)).filter((item) => item !== undefined)
    : guides.filter((item) => item.slug !== guide.slug).slice(0, 3);
  const publishedIso = guide.publishedIso ?? "2026-10-29";
  const publishedLabel = new Date(`${publishedIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  const isSeoGuide = seoGuides.some((item) => item.slug === guide.slug);
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

  const reserveHref = isSeoGuide
    ? `/reserve?utm_source=seo&utm_medium=guide&utm_campaign=${guide.slug}&utm_content=${guide.slug}&ref=${guide.slug}`
    : `/reserve?utm_source=organic&utm_medium=guide&utm_campaign=${guide.slug}&utm_content=guide-${guide.slug}-reserve&ref=${guide.slug}`;

  return (
    <div className="interior">
      <FunnelTracker event="page_view" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader ctaHref={reserveHref} />
      <main>
        <article className="guide-article">
          <header className="guide-hero shell">
            <Link href="/guides" className="guide-back">
              <ArrowLeft size={17} aria-hidden="true" /> All guides
            </Link>
            <p className="kicker">{guide.eyebrow}</p>
            <h1>{guide.h1 ?? guide.title}</h1>
            <p className="guide-intro">{guide.intro}</p>
            <p className="guide-meta">Published {publishedLabel} · {guide.readingTime}</p>
          </header>

          <div className="guide-body shell">
            {guide.sections.map((section, index) => (
              <section key={section.title} aria-labelledby={`section-${index + 1}`}>
                <p className="guide-section-number">{String(index + 1).padStart(2, "0")}</p>
                <h2 id={`section-${index + 1}`}>{section.title}</h2>
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
                {index === 0 ? (
                  <div className="guide-inline-cta">
                    <p>{isSeoGuide ? "Want feedback on your own profile? Share a screenshot." : "Want this done for your own profile?"}</p>
                    <CtaLink href={reserveHref} location={`guide_${guide.slug}_inline`} className="btn btn-primary btn-small">Get started</CtaLink>
                  </div>
                ) : null}
              </section>
            ))}

            {guide.sources ? (
              <section className="guide-sources" aria-labelledby="guide-sources-title">
                <p className="kicker">Source notes</p>
                <h2 id="guide-sources-title">Sources and platform context</h2>
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
              </section>
            ) : null}

            <section className="guide-checklist" aria-labelledby="review-checklist">
              <p className="kicker">Quick review</p>
              <h2 id="review-checklist">Your checklist</h2>
              <ul>
                {guide.checklist.map((item) => (
                  <li key={item}><span className="check-dot"><Check size={14} aria-hidden="true" /></span>{item}</li>
                ))}
              </ul>
            </section>

            <section className="guide-faq" aria-labelledby="guide-faq-title">
              <p className="kicker">Common questions</p>
              <h2 id="guide-faq-title">FAQ</h2>
              <dl>
                {guide.faqs.map((faq) => (
                  <div key={faq.question}>
                    <dt>{faq.question}</dt>
                    <dd>{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <aside className="guide-cta" aria-labelledby="guide-cta-title">
              <p className="kicker">Want a second pair of eyes?</p>
              <h2 id="guide-cta-title">Keep the account. Get better drafts.</h2>
              <p>
                NoSwipe is building a screenshot-based dating concierge. We can review photos, draft profile copy and messages, and help plan dates. You make profile changes, swipe, send messages and confirm dates yourself.
              </p>
              <CtaLink href={reserveHref} location={`guide_${guide.slug}`} className="btn btn-lime">
                Get started
              </CtaLink>
              <small>Takes about a minute. You see the exact price before you pay anything.</small>
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
      <SiteFooter />
    </div>
  );
}
