import Link from "next/link";
import { CtaLink } from "@/components/cta-link";
import { FunnelTracker } from "@/components/funnel-tracker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { AiPage } from "@/content/ai-pages";

const site = "https://www.noswipe.app";

export function aiPageMetadata(page: AiPage) {
  return {
    title: page.metaTitle,
    description: page.description,
    alternates: { canonical: page.path },
    openGraph: { type: "article" as const, siteName: "NoSwipe", title: page.metaTitle, description: page.description, url: page.path, publishedTime: page.publishedIso, authors: ["NoSwipe"] },
    twitter: { card: "summary_large_image" as const, title: page.metaTitle, description: page.description }
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
      dateModified: page.publishedIso,
      mainEntityOfPage: url,
      author: { "@type": "Organization", name: "NoSwipe", url: site },
      publisher: { "@type": "Organization", name: "NoSwipe", url: site }
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map((faq) => ({ "@type": "Question", name: faq.question, acceptedAnswer: { "@type": "Answer", text: faq.answer } }))
    }
  ];
  const slug = page.path.slice(1);
  const reserveHref = `/reserve?utm_source=seo&utm_medium=answer&utm_campaign=${slug}&ref=${slug}`;
  const publishedLabel = new Date(`${page.publishedIso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  return (
    <div className="interior">
      <FunnelTracker event="page_view" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <SiteHeader ctaHref={reserveHref} />
      <main>
        <article className="guide-article">
          <header className="guide-hero shell">
            <p className="kicker">{page.eyebrow}</p>
            <h1>{page.h1}</h1>
            <p className="guide-intro">{page.answer}</p>
            <p className="guide-meta">Published {publishedLabel}</p>
          </header>

          <div className="guide-body shell">
            {page.sections.map((section, index) => (
              <section key={section.title} aria-labelledby={`section-${index + 1}`}>
                <h2 id={`section-${index + 1}`}>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
              </section>
            ))}

            <section className="guide-faq" aria-labelledby="guide-faq-title">
              <p className="kicker">Common questions</p>
              <h2 id="guide-faq-title">FAQ</h2>
              <dl>
                {page.faqs.map((faq) => (
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
              <p>NoSwipe drafts profile suggestions, openers, replies and date plans from screenshots you share. You make profile changes, send messages and confirm dates yourself.</p>
              <CtaLink href={reserveHref} location={`answer_${slug}`} className="btn btn-lime">Get started</CtaLink>
              <small>Takes about a minute. You see the exact price before you pay anything.</small>
            </aside>
          </div>

          <nav className="shell related-guides" aria-label="Related reading">
            <p className="kicker">Keep reading</p>
            <div>
              {page.related.map((item) => <Link href={item.href} key={item.href}>{item.label}</Link>)}
            </div>
          </nav>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
