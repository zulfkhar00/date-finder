import Link from "next/link";
import { CtaLink } from "@/components/cta-link";
import { GuideBridge } from "@/components/guide-bridge";
import { GuideStickyCta } from "@/components/guide-sticky-cta";
import { FunnelTracker } from "@/components/funnel-tracker";
import { Acc, FaqItems, ShortHero, quotedBullets } from "@/components/short/parts";
import { CopyCards, type CopyItem } from "@/components/short/copy-cards";
import { HowSteps } from "@/components/short/how-steps";
import { promiseFor } from "@/content/promises";
import { QuickCompare } from "@/components/short/quick-compare";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { AiPage } from "@/content/ai-pages";
import { ogImages } from "@/lib/og";

const site = "https://www.noswipe.app";

export function aiPageMetadata(page: AiPage) {
  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: { images: ogImages, type: "article" as const, siteName: "NoSwipe", title: page.metaTitle, description: page.description, url: page.path, publishedTime: page.publishedIso, modifiedTime: page.updatedIso ?? page.publishedIso, authors: ["NoSwipe"] },
    twitter: { images: ogImages, card: "summary_large_image" as const, title: page.metaTitle, description: page.description }
  };
}

export function AiAnswerPage({ page }: { page: AiPage }) {
  const url = `${site}${page.path}`;
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: page.h1,
      description: page.description,
      datePublished: page.publishedIso,
      dateModified: page.updatedIso ?? page.publishedIso,
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: "NoSwipe", url: site },
      publisher: { "@type": "Organization", name: "NoSwipe", url: site }
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${site}/#organization`,
      name: "NoSwipe",
      url: site,
      logo: `${site}/brand/email-logo.png`,
      email: "support@noswipe.app"
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "NoSwipe",
      url: site,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      description: "AI dating concierge: swipes, chats and books dates for you on your own Tinder, Hinge and Bumble accounts. You just show up.",
      publisher: { "@id": `${site}/#organization` },
      offers: { "@type": "Offer", price: "1.00", priceCurrency: "USD", description: "One-time, refundable early-access payment. Does not start a service.", url: `${site}/onboarding` }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "NoSwipe", item: site },
        { "@type": "ListItem", position: 2, name: page.eyebrow, item: url }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } }))
    }
  ];
  const slug = page.path.slice(1);
  const reserveHref = `/onboarding?ref=${slug}`;
  const reserveUtm = `utm_source=seo&utm_medium=answer&utm_campaign=${slug}`;
  const publishedLabel = new Date(`${page.publishedIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  const updatedLabel = page.updatedIso && page.updatedIso !== page.publishedIso ? new Date(`${page.updatedIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : null;

  const examples: CopyItem[] = page.sections.flatMap((section) => quotedBullets(section.bullets)).slice(0, 6);
  const showCompare = Boolean(page.comparison) || ["/noswipe-vs-rizz-yourmove-keys-ai", "/best-ai-dating-assistant-2026", "/dating-app-message-assistant"].includes(page.path);

  return (
    <div className="interior">
      <FunnelTracker event="page_view" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <SiteHeader ctaHref={reserveHref} ctaUtm={reserveUtm} />
      <main>
        <article className="guide-article short-page">
          <ShortHero h1={page.h1} promise={promiseFor(page.path)} href={reserveHref} utm={reserveUtm} location={`answer_${slug}_hero`} />
          <HowSteps />
          <CopyCards items={examples} title="Copy a line" />
          {showCompare ? <QuickCompare /> : null}

          <div className="shell short-more">
            <Acc title="The full answer">
              <p>{page.answer}</p>
              <p className="guide-meta">Published {publishedLabel}{updatedLabel ? ` · Updated ${updatedLabel}` : ""}</p>
            </Acc>
            <GuideBridge href={reserveHref} utm={reserveUtm} location={`answer_${slug}_bridge`} />
            {page.steps ? (
              <Acc title="How it works, in detail" id="how-it-works">
                <ol>{page.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              </Acc>
            ) : null}
            {page.sections.map((section, index) => (
              <Acc key={section.title} title={section.title} id={`section-${index + 1}`}>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
              </Acc>
            ))}

            {page.comparison ? (
              <Acc title={page.comparison.title} id="comparison-title">
                <p>{page.comparison.intro}</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ textAlign: "left", padding: 8 }}><span className="sr-only">Topic</span></th>
                        {page.comparison.columns.map((column) => <th scope="col" key={column} style={{ textAlign: "left", padding: 8 }}>{column}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {page.comparison.rows.map((row) => (
                        <tr key={row.label} style={{ borderTop: "1px solid rgba(128,128,128,.3)" }}>
                          <th scope="row" style={{ textAlign: "left", padding: 8, verticalAlign: "top" }}>{row.label}</th>
                          {row.cells.map((cell, i) => <td key={i} style={{ padding: 8, verticalAlign: "top" }}>{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Acc>
            ) : null}

            <Acc title="FAQ" id="guide-faq-title" className="guide-faq">
              <FaqItems faqs={page.faqs} />
            </Acc>

            <aside className="guide-cta" aria-labelledby="guide-cta-title">
              <h2 id="guide-cta-title">Rather skip the swiping?</h2>
              <p>NoSwipe is a dating app concierge. It swipes, chats and books dates for you.</p>
              <CtaLink href={reserveHref} utm={reserveUtm} location={`answer_${slug}`} className="btn btn-lime">Get started</CtaLink>
            </aside>
          </div>

          <nav className="shell related-guides" aria-label="Related guides">
            <p className="kicker">Related guides</p>
            <div>
              {page.related.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
            </div>
          </nav>
        </article>
      </main>
      <GuideStickyCta href={reserveHref} utm={reserveUtm} slug={slug} />
      <SiteFooter />
    </div>
  );
}
