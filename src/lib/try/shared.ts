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
/**
 * Vercel functions reject request bodies over 4.5 MB before our code runs. The browser keeps the whole
 * upload under TOTAL_UPLOAD_BYTES (each image is squeezed to TARGET_IMAGE_BYTES or less) and the server
 * refuses anything over MAX_REQUEST_BYTES with a clear message.
 */
export const TOTAL_UPLOAD_BYTES = 3_800_000;
export const TARGET_IMAGE_BYTES = Math.floor(TOTAL_UPLOAD_BYTES / MAX_IMAGES);
export const MAX_REQUEST_BYTES = 4_400_000;

export const TRY_KIND_LABELS: Record<TryKind, { title: string; hint: string; max: number }> = {
  profile: { title: "My profile", hint: "Up to 6 photos or screenshots of your profile. You get a photo ranking, a bio and prompt answers.", max: MAX_IMAGES },
  opener: { title: "A new match", hint: "A screenshot of their profile. You get 3 openers to choose from.", max: 3 },
  reply: { title: "A chat", hint: "A screenshot of your conversation. You get reply options and a read on where it stands.", max: 3 }
};

export type TryErrorCode = "invalid_input" | "daily_limit" | "capacity" | "unavailable" | "failed" | "too_large";
