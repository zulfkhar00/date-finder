-- Traffic capture + video performance. Run after 2026-11-02-funnel-steps.sql.
-- Additive and idempotent: every statement is "if not exists" / drop-then-add, nothing is dropped
-- or rewritten, existing rows keep NULL in the new columns. Safe to run twice and safe to run before
-- or after the deploy: the app falls back to the old row shape while the columns are missing.
--
-- No personal data: a host, a path, a device class, a 2-letter country. Never the IP or the full UA.

-- 1. funnel_events: where a visit came from and what it looked like. All nullable.
alter table public.funnel_events add column if not exists utm_source text;
alter table public.funnel_events add column if not exists utm_medium text;
alter table public.funnel_events add column if not exists utm_content text;
alter table public.funnel_events add column if not exists referrer_host text;
alter table public.funnel_events add column if not exists landing_path text;
alter table public.funnel_events add column if not exists device text;
alter table public.funnel_events add column if not exists country text;

alter table public.funnel_events drop constraint if exists funnel_events_traffic_check;
alter table public.funnel_events add constraint funnel_events_traffic_check check (
  (utm_source is null or char_length(utm_source) between 1 and 200)
  and (utm_medium is null or char_length(utm_medium) between 1 and 200)
  and (utm_content is null or char_length(utm_content) between 1 and 200)
  and (referrer_host is null or char_length(referrer_host) between 1 and 100)
  and (landing_path is null or (char_length(landing_path) between 1 and 120 and landing_path like '/%'))
  and (device is null or device in ('mobile', 'tablet', 'desktop', 'bot'))
  and (country is null or country ~ '^[A-Z]{2}$')
);

-- 2. reservations already carry utm_source / utm_medium (2026-10-23-funnel-tracking.sql); this is a
-- no-op there and only guards a database that skipped that file.
alter table public.reservations add column if not exists utm_source text;
alter table public.reservations add column if not exists utm_medium text;

-- 3. content_posts: per-video performance, written by the posting-queue sync. All nullable;
-- metrics_at is when the numbers were read from Instagram.
alter table public.content_posts add column if not exists views integer;
alter table public.content_posts add column if not exists likes integer;
alter table public.content_posts add column if not exists comments integer;
alter table public.content_posts add column if not exists shares integer;
alter table public.content_posts add column if not exists reach integer;
alter table public.content_posts add column if not exists saves integer;
alter table public.content_posts add column if not exists metrics_at timestamptz;

alter table public.content_posts drop constraint if exists content_posts_metrics_check;
alter table public.content_posts add constraint content_posts_metrics_check check (
  (views is null or views >= 0) and (likes is null or likes >= 0) and (comments is null or comments >= 0)
  and (shares is null or shares >= 0) and (reach is null or reach >= 0) and (saves is null or saves >= 0)
);

-- 4. Access stays server-only (same as schema.sql / funnel-tracking.sql / content-posts.sql).
alter table public.funnel_events enable row level security;
alter table public.reservations enable row level security;
alter table public.content_posts enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;
revoke all on public.content_posts from public, anon, authenticated;

notify pgrst, 'reload schema';
