// Tagged-link builder for the admin "Links" tool. Pure, no I/O. A link built here lands as
// utm_source / utm_medium / utm_campaign / utm_content on the first page_view, so the visit is
// attributed to the exact bio link, reel or post instead of "direct".

export const LINK_BASE = "https://noswipe.app";

export type LinkPreset = { id: string; label: string; source: string; medium: string; campaign: string; contentHint?: string };

export const LINK_PRESETS: LinkPreset[] = [
  { id: "ig-bio", label: "Instagram bio", source: "instagram", medium: "bio", campaign: "profile" },
  { id: "ig-reel", label: "Instagram reel", source: "instagram", medium: "reel", campaign: "reels", contentHint: "reel shortcode or slug" },
  { id: "tt-bio", label: "TikTok bio", source: "tiktok", medium: "bio", campaign: "profile" },
  { id: "tt-video", label: "TikTok video", source: "tiktok", medium: "video", campaign: "videos", contentHint: "video id or slug" },
  { id: "ph", label: "Product Hunt", source: "producthunt", medium: "launch", campaign: "launch" },
  { id: "reddit", label: "Reddit post", source: "reddit", medium: "social", campaign: "post", contentHint: "subreddit or post slug" },
  { id: "x", label: "X post", source: "x", medium: "social", campaign: "post", contentHint: "post slug" },
  { id: "threads", label: "Threads post", source: "threads", medium: "social", campaign: "post", contentHint: "post slug" }
];

export const LANDING_CHOICES = [
  { path: "/", label: "Home" },
  { path: "/onboarding", label: "Onboarding (skip the landing page)" },
  { path: "/guides", label: "Guides index" },
  { path: "/try", label: "Free tool (/try)" }
] as const;

/** utm values: lowercase, a-z 0-9 and - _ . only, spaces become "-", max 60. Empty -> "". */
export function slugUtm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9._-]/g, "").replace(/-{2,}/g, "-").slice(0, 60);
}

export type LinkInput = { path?: string; source: string; medium: string; campaign?: string; content?: string; term?: string };
export type LinkResult = { ok: true; url: string } | { ok: false; error: string };

/** Builds https://noswipe.app/<path>?utm_... Source and medium are required; the path must be on our own site. */
export function buildUtmLink(input: LinkInput, base: string = LINK_BASE): LinkResult {
  const source = slugUtm(input.source);
  const medium = slugUtm(input.medium);
  if (!source) return { ok: false, error: "Source is required (for example instagram)." };
  if (!medium) return { ok: false, error: "Medium is required (for example bio or reel)." };
  const rawPath = (input.path ?? "/").trim() || "/";
  if (!rawPath.startsWith("/") || rawPath.startsWith("//") || /[\s?#\\]/.test(rawPath)) return { ok: false, error: "Landing page must be a path on noswipe.app, like /guides (no query or #)." };
  const url = new URL(rawPath, base);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  for (const [key, value] of [["utm_campaign", input.campaign], ["utm_content", input.content], ["utm_term", input.term]] as const) {
    const v = slugUtm(value ?? "");
    if (v) url.searchParams.set(key, v);
  }
  return { ok: true, url: url.toString() };
}
