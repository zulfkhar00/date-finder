import type { MetadataRoute } from "next";

const siteUrl = "https://www.noswipe.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/", "/confirmation"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
