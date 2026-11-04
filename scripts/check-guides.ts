import assert from "node:assert/strict";
import sitemap from "../src/app/sitemap";
import { expandedGuides } from "../src/content/guide-expansion";
import robots from "../src/app/robots";
import { aiPages } from "../src/content/ai-pages";
import { llmsFullTxt, llmsTxt } from "../src/lib/llms";
import { guideSeo } from "../src/content/guide-seo";
import { getGuide, guideSlugs, guides, seoGuides } from "../src/content/guides";

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
// This allowlist is article-specific: a source can support profile advice but
// still be only platform context for a different editorial framework.
const expectedGuidanceUrls: Record<string, string[]> = {
  "how-to-get-more-tinder-matches": [],
  "how-to-get-more-bumble-matches": [],
  "how-to-get-more-hinge-matches": [
    "https://hinge.co/how-we-connect-daters",
    "https://hinge.co/newsroom/profile-refresh-guide",
    "https://hinge.co/newsroom/prompt-feedback"
  ],
  "why-you-get-no-matches": ["https://hinge.co/how-we-connect-daters"],
  "dating-app-photo-order-men": ["https://hinge.co/newsroom/profile-refresh-guide"],
  "hinge-prompts-for-men": [
    "https://hinge.co/newsroom/prompt-feedback",
    "https://hinge.co/newsroom/profile-refresh-guide"
  ],
  "tinder-bio-for-men": [],
  "first-message-after-match": ["https://hinge.co/newsroom/convo-starters"],
  "when-to-ask-her-out": []
};
const sourceKindLabels = {
  guidance: "Supporting guidance",
  "platform-context": "Platform context",
  background: "Background context"
};
const sitemapUrls = sitemap().map((entry) => entry.url);
assert.ok(!sitemapUrls.some((url) => /\/(try|reserve)$/.test(url)), "the removed /try and /reserve pages are not in the sitemap");
assert.ok(sitemapUrls.includes("https://www.noswipe.app/demo"), "the demo is in the sitemap");
assert.deepEqual(expandedGuides.map((guide) => guide.slug), expectedSlugs);
assert.equal(new Set(guideSlugs).size, guides.length, "guide routes must be unique");
assert.equal(guides.length, 32, "four original guides, nine expansions and nineteen SEO guides");
assert.equal(seoGuides.length, 19);
assert.equal(getGuide("not-a-guide"), undefined);

for (const guide of guides) {
  assert.equal(getGuide(guide.slug), guide);
  assert.equal(sitemapUrls.filter((url) => url === `https://www.noswipe.app/guides/${guide.slug}`).length, 1);
}

for (const guide of expandedGuides) {
  assert.ok(guide.title && guide.description && guide.intro);
  assert.ok(guide.sections.length >= 4 && guide.checklist.length >= 5 && guide.faqs.length >= 3);
  assert.ok(guide.sources && guide.sources.length > 0, `${guide.slug}: source and platform context links are required`);
  assert.deepEqual(guide.sources.filter((source) => source.kind === "guidance").map((source) => source.url), expectedGuidanceUrls[guide.slug], `${guide.slug}: only directly supporting advice sources may be guidance`);
  const editorialCopy = guide.sections.flatMap((section) => section.paragraphs).join(" ");
  assert.doesNotMatch(editorialCopy, /Bumble's (?:own help center|standing-out guidance|public photo guidance).{0,40}(?:emphasizes|encourages|reinforce)/i, `${guide.slug}: do not paraphrase unverified Bumble help`);
  for (const source of guide.sources) {
    const url = new URL(source.url);
    assert.equal(url.protocol, "https:");
    assert.ok(primaryHosts.has(url.hostname), `${guide.slug}: cite a public primary source`);
    assert.ok(source.label);
    assert.ok(Object.hasOwn(sourceKindLabels, source.kind), `${guide.slug}: source role must be explicit`);
    if (url.hostname === "support.bumble.com" || /TERMS|terms|\.pdf$/i.test(source.url)) {
      assert.equal(source.kind, "platform-context", `${guide.slug}: help and terms are platform context, not editorial evidence`);
    }
    if (url.hostname === "www.pewresearch.org") assert.equal(source.kind, "background");
  }
  assert.equal(new Set(guide.sources.map((source) => source.url)).size, guide.sources.length);
  assert.equal(guide.relatedSlugs?.length, 3, `${guide.slug}: include three relevant next reads`);
  for (const slug of guide.relatedSlugs) {
    assert.notEqual(slug, guide.slug);
    assert.ok(getGuide(slug), `${guide.slug}: related guide ${slug} must exist`);
  }
  assert.ok(expandedGuides.some((other) => other.relatedSlugs?.includes(guide.slug)), `${guide.slug}: must have an inbound related link`);
}

const liveSlugs = new Set([...guides.slice(0, 13)].map((guide) => guide.slug));
const seoSlugs = new Set(seoGuides.map((guide) => guide.slug));
const seoTitles = new Set<string>();
const seoDescriptions = new Set<string>();
for (const guide of seoGuides) {
  assert.ok(guide.sections.length >= 4 && guide.checklist.length >= 5 && guide.faqs.length >= 3, `${guide.slug}: structure`);
  assert.equal(guide.relatedSlugs?.length, 3, `${guide.slug}: three related links`);
  assert.equal(guide.relatedSlugs!.filter((slug) => liveSlugs.has(slug)).length, 2, `${guide.slug}: two links to live guides`);
  assert.equal(guide.relatedSlugs!.filter((slug) => seoSlugs.has(slug)).length, 1, `${guide.slug}: one link to a new guide`);
  assert.ok(guide.description.length >= 80 && guide.description.length <= 200, `${guide.slug}: description length`);
  seoTitles.add(guide.title);
  seoDescriptions.add(guide.description);
  const text = [guide.intro, ...guide.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? []), s.example?.text ?? ""]), ...guide.checklist, ...guide.faqs.flatMap((f) => [f.question, f.answer])].join(" ");
  const words = text.split(/\s+/).length;
  assert.ok(words >= 720 && words <= 1300, `${guide.slug}: ${words} words, expected 720-1300 of article copy (800+ with page chrome)`);
  assert.doesNotMatch(text, /\bautomates?\b|do it for you|\$\s?1\b|\breserve\b(?! the right)|wait-?list/i, `${guide.slug}: banned phrasing`);
  for (const section of guide.sections) {
    if (section.example) assert.equal(section.example.label, "Example", `${guide.slug}: examples are labelled`);
  }
}
assert.equal(seoTitles.size, 19);
assert.equal(seoDescriptions.size, 19);

const metaTitles = new Set<string>();
const queries = new Set<string>();
for (const guide of guides) {
  const seo = guideSeo[guide.slug];
  assert.ok(seo, `${guide.slug}: needs a target query entry`);
  assert.ok(guide.metaTitle && `${guide.metaTitle} — NoSwipe`.length <= 60, `${guide.slug}: title tag must be 60 chars or less with suffix`);
  assert.ok(guide.description.length <= 155 && guide.description.length >= 80, `${guide.slug}: description length ${guide.description.length}`);
  assert.ok(guide.h1 && guide.intro, `${guide.slug}: h1 and intro`);
  metaTitles.add(guide.metaTitle!);
  queries.add(seo.query);
  const copy = [guide.metaTitle, guide.h1, guide.description, guide.intro].join(" ");
  assert.doesNotMatch(copy, /\bautomates?\b|\$\s?\d|wait-?list|\breserve\b|\d+\s?%/i, `${guide.slug}: banned phrasing in SEO copy`);
}
assert.equal(metaTitles.size, guides.length, "title tags must be unique");
assert.equal(queries.size, guides.length, "target queries must be unique");

assert.equal(aiPages.length, 7);
for (const page of aiPages) {
  assert.equal(page.answer.split(/(?<=[.!?])\s+/).length, 2, `${page.path}: direct answer must be exactly two sentences`);
  assert.ok(page.faqs.length >= 4, `${page.path}: FAQ block`);
  assert.ok(`${page.metaTitle} — NoSwipe`.length <= 60 && page.description.length <= 155, `${page.path}: title/description length`);
  assert.ok(sitemapUrls.includes(`https://www.noswipe.app${page.path}`), `${page.path}: in sitemap`);
  assert.doesNotMatch([page.answer, ...page.sections.flatMap((x) => x.paragraphs)].join(" "), /\d+\s?%/i, `${page.path}: no stats`); // automation positioning allowed (Miko, 4 Nov 2026)
}
for (const text of [llmsTxt(), llmsFullTxt()]) {
  assert.match(text, /swipes on people who match/i);
  assert.match(text, /books the first date/i);
  assert.match(text, /USD 1/);
  for (const page of aiPages) assert.ok(text.includes(page.path), `llms: ${page.path}`);
}
const robotsAgents = robots().rules;
for (const agent of ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"]) {
  assert.ok(Array.isArray(robotsAgents) && robotsAgents.some((rule) => rule.userAgent === agent && rule.allow === "/"), `robots: ${agent}`);
}

console.log("guides: 32 unique routes, nine sourced expansions, sitemap entries and related links passed");

async function checkRenderedGuides(baseUrl: string) {
  const indexResponse = await fetch(`${baseUrl}/guides`);
  assert.equal(indexResponse.status, 200);
  const indexHtml = await indexResponse.text();
  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert.equal(sitemapResponse.status, 200);
  const sitemapXml = await sitemapResponse.text();
  const refs = new Set<string>();

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
    const startLinks = links.filter((href) => href.startsWith("/onboarding"));
    assert.equal(links.filter((href) => href.startsWith("/try") || href.startsWith("/reserve")).length, 0, `${path}: no links to the removed /try or /reserve`);
    assert.equal(startLinks.length, 3, `${path}: header, inline and closing CTAs go to onboarding`);
    // UTMs are recorded on click (CtaLink's `utm` prop), so crawlers see one untagged URL per page.
    for (const link of startLinks) {
      // UTMs are recorded on click (CtaLink's `utm` prop), so crawlers see one untagged URL per page.
      assert.equal(link, `/onboarding?ref=${guide.slug}`, `${path}: CTA href carries only ref`);
      refs.add(link);
    }
    assert.ok(html.includes("You see the exact price before you pay anything."));
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ""), /\$\s?1\b|wait-?list|reserve a (?:place|spot)|holds? your spot/i, `${path}: no pre-checkout price or waitlist copy`);
    assert.ok(html.includes("It fixes your profile, swipes on people who fit, chats in your voice and books the date."));
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    assert.ok(jsonLd, `${path}: structured data`);
    const data = JSON.parse(jsonLd[1]);
    assert.deepEqual(data.map((item: { "@type": string }) => item["@type"]), ["Article", "BreadcrumbList", "FAQPage"]);
    assert.equal(data[0].mainEntityOfPage, canonical);
    assert.equal(data[2].mainEntity.length, guide.faqs.length);
    assert.equal(data[2].mainEntity[0].acceptedAnswer.text, guide.faqs[0].answer);
    const expectedCitations = expectedGuidanceUrls[guide.slug] ?? [];
    assert.equal(Object.hasOwn(data[0], "citation"), expectedCitations.length > 0, `${path}: omit citation when no substantive guidance source applies`);
    if (expectedCitations.length) assert.deepEqual(data[0].citation, expectedCitations, `${path}: only supporting guidance belongs in Article.citation`);
    if (guide.sources) {
      assert.ok(html.includes("Sources and platform context"), `${path}: accurate source heading`);
      assert.ok(html.includes("Examples and checklists are NoSwipe editorial guidance."));
      assert.ok(!html.includes("Read the current guidance"));
      const sourceItems = [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((match) => match[1]);
      for (const source of guide.sources) {
        assert.ok(links.includes(source.url), `${path}: visible source link`);
        const sourceItem = sourceItems.find((item) => item.includes(`href="${source.url}"`));
        assert.ok(sourceItem?.includes(sourceKindLabels[source.kind]), `${path}: visible source role`);
        if (source.kind !== "guidance") assert.ok(!(data[0].citation ?? []).includes(source.url), `${path}: context is not a substantive citation`);
      }
    }
    for (const slug of guide.relatedSlugs ?? []) {
      assert.ok(links.includes(`/guides/${slug}`), `${path}: related link`);
    }
  }
  assert.equal(refs.size, guides.length);
  assert.equal((await fetch(`${baseUrl}/guides/not-a-guide`)).status, 404);
  console.log("guides HTTP: all 32 pages, metadata, JSON-LD, attributed CTAs, citations, index, sitemap and 404 passed");
}

if (process.env.GUIDE_TEST_BASE_URL) {
  checkRenderedGuides(process.env.GUIDE_TEST_BASE_URL).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
