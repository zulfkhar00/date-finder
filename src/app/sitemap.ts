import type { MetadataRoute } from "next";
import { aiPages } from "@/content/ai-pages";
import { getGuide, guideSlugs } from "@/content/guides";

const siteUrl = "https://www.noswipe.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((slug) => ({
    url: `${siteUrl}/guides/${slug}`,
    lastModified: `${getGuide(slug)?.publishedIso ?? "2026-10-29"}T12:00:00Z`,
    changeFrequency: "monthly",
    priority: 0.7
  }));

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/reserve`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/guides`, changeFrequency: "monthly", priority: 0.8 },
    ...aiPages.map((page) => ({ url: `${siteUrl}${page.path}`, lastModified: `${page.publishedIso}T12:00:00Z`, changeFrequency: "monthly" as const, priority: 0.8 })),
    { url: `${siteUrl}/llms.txt`, changeFrequency: "monthly", priority: 0.3 },
    ...guideEntries,
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
