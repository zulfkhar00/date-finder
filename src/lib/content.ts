import { z } from "zod";

// The @noswipe.app posting queue as mirrored into content_posts (supabase/2026-10-25-content-posts.sql).
// Shared by the sync endpoint (writes) and /admin/videos (reads).

export const CONTENT_STATUSES = ["review", "fix", "scheduled", "posted", "failed", "skipped"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const CONTENT_ACTIONS = ["post_anyway", "dont_post"] as const;
export type ContentAction = (typeof CONTENT_ACTIONS)[number];

/** Which status an action applies to. Anything else is refused. */
export const ACTION_FROM_STATUS: Record<ContentAction, ContentStatus> = {
  post_anyway: "fix",
  dont_post: "scheduled"
};

export const CONTENT_PREVIEW_BUCKET = "content-previews";

const isoTime = z.iso.datetime({ offset: true });
const REF_PATTERN = /^[a-f0-9]{16,64}$/;

export const syncPostSchema = z.object({
  external_ref: z.string().regex(REF_PATTERN),
  title: z.string().max(200),
  caption: z.string().max(2200),
  status: z.enum(CONTENT_STATUSES),
  scheduled_at: isoTime.nullable(),
  posted_at: isoTime.nullable(),
  post_url: z.url({ protocol: /^https$/ }).max(500).nullable(),
  submitted_by: z.enum(["Miko", "Zulya"]).nullable(),
  source: z.enum(["telegram", "team"]),
  fixes: z.array(z.object({ t: z.string().max(40), what: z.string().max(1000) })).max(20),
  duration_s: z.number().min(0).max(9999).nullable(),
  created_at: isoTime,
  /** Preview the sync has ready for this row, or null. */
  preview: z.object({ ext: z.enum(["mp4", "jpg"]), upload: z.boolean() }).nullable()
});
export type SyncPost = z.infer<typeof syncPostSchema>;

export const syncRequestSchema = z.object({
  posts: z.array(syncPostSchema).max(500),
  done: z.array(z.object({ id: z.uuid(), result: z.string().max(300) })).max(100)
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export function previewPath(externalRef: string, ext: "mp4" | "jpg"): string {
  return `${externalRef}.${ext}`;
}

export type ContentPost = {
  id: string;
  title: string;
  caption: string;
  status: ContentStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  post_url: string | null;
  submitted_by: string | null;
  source: string;
  fixes: { t?: string; what?: string }[];
  preview_path: string | null;
  duration_s: number | null;
  created_at: string;
  updated_at: string;
};

export type OpenContentAction = { id: string; post_id: string; action: ContentAction; requested_by: string; created_at: string };
