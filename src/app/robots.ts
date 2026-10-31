import type { MetadataRoute } from "next";

const siteUrl = "https://www.noswipe.app";

const privatePaths = ["/admin/", "/api/", "/confirmation"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI assistants and answer engines may read the public site, including /llms.txt.
      ...["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"].map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths })),
      { userAgent: "*", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
