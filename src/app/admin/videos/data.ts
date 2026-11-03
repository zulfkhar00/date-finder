import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CONTENT_PREVIEW_BUCKET, type ContentPost, type OpenContentAction } from "@/lib/content";
import { AdminDataError } from "../_lib/data";
import { loadTrafficRows } from "../_lib/traffic-data";
import { buildTrafficModel, DAY, dayKey } from "@/lib/traffic-report";

export const PT_ZONE = "America/Los_Angeles";
const POST_COLUMNS = "id, title, caption, status, scheduled_at, posted_at, post_url, submitted_by, source, fixes, preview_path, duration_s, created_at, updated_at";
const METRIC_COLUMNS = "views, likes, comments, shares, reach, saves, metrics_at";

const PREVIEW_TTL_S = 600;

/** Site visits that came from Instagram (utm_source or referrer), per Pacific day and per reel. */
export type InstagramVisits = { perDay: { day: string; count: number }[]; total: number; byShortcode: Map<string, number> };

export type VideosData = {
  posts: ContentPost[];
  /** false until supabase/2026-11-03-traffic.sql adds the metric columns. */
  metricsAvailable: boolean;
  nowMs: number;
  /** null when traffic could not be read (the page then simply omits it). */
  instagram: InstagramVisits | null;
  open: Map<string, OpenContentAction>;
  previews: Map<string, string>;
};

/** Every mirrored video (newest 400), open admin requests, and 10-minute signed preview URLs. */
export async function getVideos(): Promise<VideosData> {
  const supabase = getSupabaseAdmin();
  const fetchPosts = (columns: string) => supabase.from("content_posts").select(columns).order("created_at", { ascending: false }).limit(400);
  const [withMetrics, actionsRes, instagram] = await Promise.all([
    fetchPosts(`${POST_COLUMNS}, ${METRIC_COLUMNS}`),
    supabase.from("content_actions").select("id, post_id, action, requested_by, created_at").is("done_at", null),
    getInstagramVisits(14)
  ]);
  let postsRes = withMetrics;
  let metricsAvailable = true;
  if (withMetrics.error && (withMetrics.error.code === "42703" || withMetrics.error.code === "PGRST204")) {
    metricsAvailable = false;
    postsRes = await fetchPosts(POST_COLUMNS);
  }
  if (postsRes.error) {
    console.error("Admin query failed", "content_posts", postsRes.error.code ?? "unknown");
    throw new AdminDataError("content_posts", postsRes.error.code);
  }
  if (actionsRes.error) console.error("Admin query failed", "content_actions", actionsRes.error.code ?? "unknown");

  const posts = (postsRes.data ?? []) as unknown as ContentPost[];
  const open = new Map<string, OpenContentAction>();
  for (const action of (actionsRes.data ?? []) as OpenContentAction[]) open.set(action.post_id, action);

  const previews = new Map<string, string>();
  const paths = posts.map((post) => post.preview_path).filter((path): path is string => Boolean(path));
  if (paths.length > 0) {
    const { data, error } = await supabase.storage.from(CONTENT_PREVIEW_BUCKET).createSignedUrls(paths, PREVIEW_TTL_S);
    if (error) console.error("Admin preview URLs failed", error.name);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) previews.set(item.path, item.signedUrl);
    }
  }
  return { posts, metricsAvailable, nowMs: Date.now(), instagram, open, previews };
}

export type RequestResult = "ok" | "already" | "wrong_status" | "missing" | "unavailable";

/** Files an admin request; the sync applies it on its next pass. One open request per video. */
export async function requestAction(postId: string, action: "post_anyway" | "dont_post", fromStatus: string, email: string): Promise<RequestResult> {
  const supabase = getSupabaseAdmin();
  const { data: post, error } = await supabase.from("content_posts").select("id, status").eq("id", postId).maybeSingle();
  if (error) {
    console.error("Admin query failed", "content_posts", error.code ?? "unknown");
    return "unavailable";
  }
  if (!post) return "missing";
  if (post.status !== fromStatus) return "wrong_status";

  const { error: insertError } = await supabase.from("content_actions").insert({ post_id: postId, action, requested_by: email });
  if (insertError?.code === "23505") return "already";
  if (insertError) {
    console.error("Admin query failed", "content_actions", insertError.code ?? "unknown");
    return "unavailable";
  }
  return "ok";
}

/** Visits attributed to Instagram over the last `days` Pacific days. Same exclusions as every admin number. */
async function getInstagramVisits(days: number): Promise<InstagramVisits | null> {
  try {
    const nowMs = Date.now();
    const rows = await loadTrafficRows(nowMs - (days + 1) * DAY);
    const model = buildTrafficModel(rows.events, rows.reservations);
    const counts = new Map<string, number>();
    const byShortcode = new Map<string, number>();
    let total = 0;
    for (const s of model.sessions.values()) {
      if (!s.pageView || s.firstAt < nowMs - days * DAY) continue;
      if (s.ref) byShortcode.set(s.ref, (byShortcode.get(s.ref) ?? 0) + 1);
      if (s.channel !== "instagram") continue;
      total += 1;
      const k = dayKey(s.firstAt, PT_ZONE);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const perDay = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const day = dayKey(nowMs - i * DAY, PT_ZONE);
      perDay.push({ day, count: counts.get(day) ?? 0 });
    }
    return { perDay, total, byShortcode };
  } catch {
    return null;
  }
}
