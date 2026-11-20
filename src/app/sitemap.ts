import type { MetadataRoute } from "next";
import { aiPages } from "@/content/ai-pages";
import { getGuide, guideSlugs } from "@/content/guides";

const siteUrl = "https://www.noswipe.app";
// The homepage has its own update date because it ships independently.
const homepageUpdated = "2026-11-18";
const siteUpdated = "2026-11-11T12:00:00Z";

export default function sitemap(): MetadataRoute.Sitemap {
  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((slug) => ({
    url: `${siteUrl}/guides/${slug}`,
    lastModified: `${getGuide(slug)?.publishedIso ?? "2026-10-29"}T12:00:00Z`,
    changeFrequency: "monthly",
    priority: 0.7
  }));

  return [
    { url: siteUrl, lastModified: homepageUpdated, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/demo`, lastModified: siteUpdated, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/guides`, lastModified: siteUpdated, changeFrequency: "monthly", priority: 0.8 },
    ...aiPages.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: `${page.updatedIso ?? page.publishedIso}T12:00:00Z`, changeFrequency: "monthly" as const, priority: 0.8 })),
    ...guideEntries,
    { url: `${siteUrl}/privacy`, lastModified: "2026-11-04T12:00:00Z", changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, lastModified: "2026-11-04T12:00:00Z", changeFrequency: "yearly", priority: 0.2 },
  ];
}
