import assert from "node:assert/strict";
import sitemap from "../src/app/sitemap";
import { expandedGuides } from "../src/content/guide-expansion";
import { getGuide, guideSlugs, guides } from "../src/content/guides";

const expectedSlugs = [
  "how-to-get-more-tinder-matches",
  "how-to-get-more-bumble-matches",
  "how-to-get-more-hinge-matches",
  "why-you-get-no-matches",
  "dating-app-photo-order-men",
  "hinge-prompts-for-men",
  "tinder-bio-for-men",
  "first-message-after-match",
  "when-to-ask-her-out"
];
const primaryHosts = new Set([
  "tinder.com", "bumble.com", "support.bumble.com", "hinge.co", "files.hinge.co", "www.pewresearch.org"
]);
const sitemapUrls = sitemap().map((entry) => entry.url);
assert.deepEqual(expandedGuides.map((guide) => guide.slug), expectedSlugs);
assert.equal(new Set(guideSlugs).size, guides.length, "guide routes must be unique");
assert.equal(guides.length, 13, "preserve the four original guides and add nine");
assert.equal(getGuide("not-a-guide"), undefined);

for (const guide of guides) {
  assert.equal(getGuide(guide.slug), guide);
  assert.equal(sitemapUrls.filter((url) => url === `https://www.noswipe.app/guides/${guide.slug}`).length, 1);
}

for (const guide of expandedGuides) {
  assert.ok(guide.title && guide.description && guide.intro);
  assert.ok(guide.sections.length >= 4 && guide.checklist.length >= 5 && guide.faqs.length >= 3);
  assert.ok(guide.sources && guide.sources.length > 0, `${guide.slug}: primary sources are required`);
  for (const source of guide.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(primaryHosts.has(url.hostname), `${guide.slug}: cite a public primary source`);
    assert.ok(source.label);
  }
  assert.equal(new Set(guide.sources.map((source) => source.url)).size, guide.sources.length);
  assert.equal(guide.relatedSlugs?.length, 3, `${guide.slug}: include three relevant next reads`);
  for (const slug of guide.relatedSlugs) {
    assert.notEqual(slug, guide.slug);
    assert.ok(getGuide(slug), `${guide.slug}: related guide ${slug} must exist`);
  }
  assert.ok(expandedGuides.some((other) => other.relatedSlugs?.includes(guide.slug)), `${guide.slug}: must have an inbound related link`);
}

console.log("guides: 13 unique routes, nine sourced expansions, sitemap entries and related links passed");

async function checkRenderedGuides(baseUrl: string) {
  const indexResponse = await fetch(`${baseUrl}/guides`);
  assert.equal(indexResponse.status, 200);
  const indexHtml = await indexResponse.text();
  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200);
  const sitemapXml = await sitemapResponse.text();
  const campaigns = new Set<string>();
  const ctaContents = new Set<string>();

  for (const guide of guides) {
    const path = `/guides/${guide.slug}`;
    const canonical = `https://www.noswipe.app${path}`;
    assert.ok(indexHtml.includes(`href="${path}"`), `${path}: linked from index`);
    assert.ok(sitemapXml.includes(`<loc>${canonical}</loc>`), `${path}: in rendered sitemap`);
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${path}: one heading`);
    assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`), `${path}: canonical`);
    assert.ok(html.includes('<meta name="description" content="'), `${path}: description`);
    assert.ok(html.includes('<meta property="og:type" content="article"'), `${path}: article metadata`);
    const links = [...html.matchAll(/<a\b[^>]*href="([^\"]+)"/g)].map((match) => match[1].replace(/&amp;/g, "&"));
    const reserveLinks = links.filter((href) => href.startsWith("/reserve"));
    assert.equal(reserveLinks.length, 1, `${path}: exactly one reserve link`);
    const cta = new URL(reserveLinks[0], baseUrl);
    assert.equal(cta.searchParams.get("utm_source"), "organic");
    assert.equal(cta.searchParams.get("utm_medium"), "guide");
    assert.equal(cta.searchParams.get("utm_campaign"), guide.slug);
    assert.equal(cta.searchParams.get("utm_content"), `guide-${guide.slug}-reserve`);
    campaigns.add(cta.searchParams.get("utm_campaign")!);
    ctaContents.add(cta.searchParams.get("utm_content")!);
    assert.ok(html.includes("waitlist fee, not payment for a completed service"));
    assert.ok(html.includes("You make profile changes, swipe, send messages and confirm dates yourself."));
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLd, `${path}: structured data`);
    const data = JSON.parse(jsonLd[1]);
    assert.deepEqual(data.map((item: { "@type": string }) => item["@type"]), ["Article", "BreadcrumbList", "FAQPage"]);
    assert.equal(data[0].mainEntityOfPage, canonical);
    assert.equal(data[2].mainEntity.length, guide.faqs.length);
    assert.equal(data[2].mainEntity[0].acceptedAnswer.text, guide.faqs[0].answer);
    if (guide.sources) {
      assert.deepEqual(data[0].citation, guide.sources.map((source) => source.url));
      for (const source of guide.sources) assert.ok(links.includes(source.url), `${path}: visible source link`);
    }
    for (const slug of guide.relatedSlugs ?? []) {
      assert.ok(links.includes(`/guides/${slug}`), `${path}: related link`);
    }
  }
  assert.equal(campaigns.size, guides.length);
  assert.equal(ctaContents.size, guides.length);
  assert.equal((await fetch(`${baseUrl}/guides/not-a-guide`)).status, 404);
  console.log("guides HTTP: all 13 pages, metadata, JSON-LD, single attributed CTAs, citations, index, sitemap and 404 passed");
}

if (process.env.GUIDE_TEST_BASE_URL) {
  checkRenderedGuides(process.env.GUIDE_TEST_BASE_URL).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
