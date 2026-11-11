import type { MetadataRoute } from "next";

const siteUrl = "https://www.noswipe.app";

const privatePaths = ["/admin", "/admin/", "/api/", "/confirmation", "/login", "/onboarding", "/home", "/chats", "/dates", "/profile", "/auth/", "/try", "/reserve"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI assistants and answer engines may read the public site, including /llms.txt.
      ...["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "anthropic-ai", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"].map((userAgent) => ({ userAgent, allow: "/", disallow: privatePaths })),
      { userAgent: "*", allow: "/", disallow: privatePaths },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
