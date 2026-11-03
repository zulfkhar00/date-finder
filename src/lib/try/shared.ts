// Constants shared by the /try page (browser) and /api/try (server). No server-only imports.

export const TRY_KINDS = ["profile", "opener", "reply"] as const;
export type TryKind = (typeof TRY_KINDS)[number];

export const TRY_APPS = ["Tinder", "Hinge", "Bumble"] as const;
export type TryApp = (typeof TRY_APPS)[number];

export const MAX_IMAGES = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Longest edge after the browser resizes a picture. Matches the size the model reads natively. */
export const MAX_IMAGE_EDGE = 1568;
export const MAX_ABOUT_CHARS = 600;
/** Hard ceiling on one request body: 6 images at the per-image cap plus form fields. */
export const MAX_REQUEST_BYTES = MAX_IMAGES * MAX_IMAGE_BYTES + 256 * 1024;

export const TRY_KIND_LABELS: Record<TryKind, { title: string; hint: string; max: number }> = {
  profile: { title: "My profile", hint: "Up to 6 photos or screenshots of your profile. You get a photo ranking, a bio and prompt answers.", max: MAX_IMAGES },
  opener: { title: "A new match", hint: "A screenshot of their profile. You get 3 openers to choose from.", max: 3 },
  reply: { title: "A chat", hint: "A screenshot of your conversation. You get reply options and a read on where it stands.", max: 3 }
};

export type TryErrorCode = "invalid_input" | "daily_limit" | "capacity" | "unavailable" | "failed" | "too_large";
