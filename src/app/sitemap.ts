import type { MetadataRoute } from "next";
import { guideSlugs } from "@/content/guides";

const siteUrl = "https://noswipe.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const guideEntries: MetadataRoute.Sitemap = guideSlugs.map((slug) => ({
    url: `${siteUrl}/guides/${slug}`,
    changeFrequency: "monthly",
    priority: 0.7
  }));

  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/reserve`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${siteUrl}/guides`, changeFrequency: "monthly", priority: 0.8 },
    ...guideEntries,
    { url: `${siteUrl}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
