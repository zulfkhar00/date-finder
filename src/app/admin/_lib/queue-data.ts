import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DAY } from "@/lib/traffic-report";

export type QueueCounts = { posted24h: number; scheduledNext24h: number };

/** Counts for the Overview alarms. null when content_posts cannot be read (alarm shows "unknown"). */
export async function getQueueCounts(nowMs: number): Promise<QueueCounts | null> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date(nowMs).toISOString();
    const [posted, scheduled] = await Promise.all([
      supabase.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "posted").gte("posted_at", new Date(nowMs - DAY).toISOString()),
      supabase.from("content_posts").select("id", { count: "exact", head: true }).eq("status", "scheduled").gte("scheduled_at", now).lte("scheduled_at", new Date(nowMs + DAY).toISOString())
    ]);
    if (posted.error || scheduled.error) {
      console.error("Admin query failed", "queue_counts", (posted.error ?? scheduled.error)?.code ?? "unknown");
      return null;
    }
    return { posted24h: posted.count ?? 0, scheduledNext24h: scheduled.count ?? 0 };
  } catch {
    return null;
  }
}
