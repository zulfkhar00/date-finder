import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-auth";
import type { ContentPost, ContentStatus, OpenContentAction } from "@/lib/content";
import { AdminDataError } from "../_lib/data";
import { Badge, QueryErrorNotice, SetupNotice } from "../_components/notices";
import { requestContentAction } from "./actions";
import { ActionButton } from "./action-button";
import { getVideos, type VideosData } from "./data";
import { Cadence, PostedStats, PostMetrics } from "./insights";
import { shortcodeFromUrl } from "@/lib/traffic-report";
import styles from "../admin.module.css";

const TABS = {
  next: { label: "Up next", statuses: ["scheduled", "review"] },
  fix: { label: "Needs fixes", statuses: ["fix"] },
  posted: { label: "Posted", statuses: ["posted"] },
  other: { label: "Failed / skipped", statuses: ["failed", "skipped"] }
} as const satisfies Record<string, { label: string; statuses: readonly ContentStatus[] }>;
type TabKey = keyof typeof TABS;

const STATUS_LABEL: Record<ContentStatus, string> = {
  review: "Checking",
  fix: "Needs fixes",
  scheduled: "Scheduled",
  posted: "Posted",
  failed: "Failed",
  skipped: "Not posting"
};

const pacific = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" });

function pt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : `${pacific.format(date)} PT`;
}

function time(value: string | null): number {
  return value ? new Date(value).getTime() || 0 : 0;
}

function sortFor(tab: TabKey, posts: ContentPost[]): ContentPost[] {
  const sorted = [...posts];
  if (tab === "next") sorted.sort((a, b) => (time(a.scheduled_at) || Infinity) - (time(b.scheduled_at) || Infinity));
  else if (tab === "posted") sorted.sort((a, b) => time(b.posted_at ?? b.scheduled_at) - time(a.posted_at ?? a.scheduled_at));
  else sorted.sort((a, b) => time(b.updated_at) - time(a.updated_at));
  return sorted;
}

export default async function AdminVideosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const access = await requireAdminPage();
  if ("unconfigured" in access) return <SetupNotice missing={access.unconfigured} />;

  const tabParam = (await searchParams).tab;
  const tab: TabKey = typeof tabParam === "string" && tabParam in TABS ? (tabParam as TabKey) : "next";

  let data: VideosData | null = null;
  let problem: "schema" | "query" | null = null;
  try {
    data = await getVideos();
  } catch (error) {
    problem = error instanceof AdminDataError && error.schemaMissing ? "schema" : "query";
  }

  const counts = Object.fromEntries(
    (Object.keys(TABS) as TabKey[]).map((key) => [key, (data?.posts ?? []).filter((post) => (TABS[key].statuses as readonly string[]).includes(post.status)).length])
  ) as Record<TabKey, number>;
  const shown = sortFor(tab, (data?.posts ?? []).filter((post) => (TABS[tab].statuses as readonly string[]).includes(post.status)));

  return (
    <main className={styles.main}>
      <div className={styles.pageHead}>
        <div>
          <h1>Videos</h1>
          <p className={styles.sub}>The @noswipe.app posting queue. Updates every 5 minutes; requests apply on the next update. Times are Pacific.</p>
        </div>
        <nav className={styles.segmented} aria-label="Videos">
          {(Object.keys(TABS) as TabKey[]).map((key) => (
            <Link key={key} href={key === "next" ? "/admin/videos" : `/admin/videos?tab=${key}`} className={`${styles.segment} ${key === tab ? styles.segmentActive : ""}`} aria-current={key === tab ? "page" : undefined}>
              {TABS[key].label} <span className={styles.muted}>{counts[key]}</span>
            </Link>
          ))}
        </nav>
      </div>

      {problem === "schema" ? (
        <div className={styles.notice}>
          The videos tables are missing. Apply <code>supabase/2026-10-25-content-posts.sql</code> in the Supabase SQL editor.
        </div>
      ) : null}
      {problem === "query" ? <QueryErrorNotice /> : null}

      {data && (tab === "posted" || tab === "next") ? (
        <>
          {tab === "posted" ? <PostedStats posts={data.posts.filter((post) => post.status === "posted")} metricsAvailable={data.metricsAvailable} byShortcode={data.instagram?.byShortcode ?? new Map()} /> : null}
          <Cadence posts={data.posts} instagram={data.instagram} nowMs={data.nowMs} />
        </>
      ) : null}

      {data ? (
        shown.length === 0 ? (
          <div className={`${styles.card} ${styles.empty}`}>Nothing here yet.</div>
        ) : (
          <section className={styles.videoGrid} aria-label={TABS[tab].label}>
            {shown.map((post) => (
              <VideoCard key={post.id} post={post} preview={post.preview_path ? data.previews.get(post.preview_path) : undefined} open={data.open.get(post.id)} visits={tab === "posted" ? data.instagram?.byShortcode.get(shortcodeFromUrl(post.post_url) ?? "") : undefined} />
            ))}
          </section>
        )
      ) : null}
    </main>
  );
}

function VideoCard({ post, preview, open, visits }: { post: ContentPost; preview?: string; open?: OpenContentAction; visits?: number }) {
  const isJpg = post.preview_path?.endsWith(".jpg");
  const fixes = Array.isArray(post.fixes) ? post.fixes.filter((fix) => fix && typeof fix.what === "string") : [];
  return (
    <article className={styles.videoCard}>
      <div className={styles.videoMedia}>
        {preview ? (
          isJpg ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimizable
            <img src={preview} alt="" loading="lazy" />
          ) : (
            <video src={preview} controls playsInline muted preload="metadata" />
          )
        ) : (
          <span className={styles.muted}>No preview</span>
        )}
      </div>
      <div className={styles.videoBody}>
        <div className={styles.videoHead}>
          <h2>{post.title.replace(/^[\s—–-]+/, "") || "Untitled"}</h2>
          <Badge value={`content_${post.status}`} label={STATUS_LABEL[post.status] ?? post.status} />
        </div>
        <dl className={styles.videoMeta}>
          {post.status === "posted" ? (
            <>
              <dt>Posted</dt>
              <dd>{pt(post.posted_at ?? post.scheduled_at)}</dd>
            </>
          ) : post.scheduled_at ? (
            <>
              <dt>Scheduled</dt>
              <dd>{pt(post.scheduled_at)}</dd>
            </>
          ) : null}
          <dt>Sent by</dt>
          <dd>{post.submitted_by ?? "Team"}</dd>
          {post.duration_s ? (
            <>
              <dt>Length</dt>
              <dd>{Math.round(Number(post.duration_s))} s</dd>
            </>
          ) : null}
        </dl>
        {post.status === "posted" ? <PostMetrics post={post} visits={visits} /> : null}
        {post.caption ? <p className={styles.videoCaption}>{post.caption}</p> : null}
        {post.status === "fix" && fixes.length > 0 ? (
          <ul className={styles.videoFixes}>
            {fixes.map((fix, index) => (
              <li key={index}>
                {fix.t && fix.t !== "—" ? <span className={styles.muted}>{fix.t} · </span> : null}
                {fix.what}
              </li>
            ))}
          </ul>
        ) : null}
        {post.post_url ? (
          <a href={post.post_url} target="_blank" rel="noopener noreferrer" className={styles.rowLink}>Open on Instagram</a>
        ) : null}
        {open ? (
          <p className={styles.sub}>
            {open.action === "post_anyway" ? "Post anyway" : "Don't post"} requested by {open.requested_by}. Applies within about 5 minutes.
          </p>
        ) : post.status === "fix" ? (
          <ActionButton action={requestContentAction.bind(null, post.id, "post_anyway")} label="Post anyway" pendingLabel="Requesting…" />
        ) : post.status === "scheduled" ? (
          <ActionButton action={requestContentAction.bind(null, post.id, "dont_post")} label="Don't post" pendingLabel="Requesting…" ghost />
        ) : null}
      </div>
    </article>
  );
}
