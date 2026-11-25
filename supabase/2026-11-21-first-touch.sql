-- First-touch + in-app source attribution. Run after 2026-11-20-*.sql. Idempotent and additive: every
-- column is nullable, "add column if not exists", nothing is rewritten; existing rows keep NULL.
-- Safe before or after the deploy: the app falls back to the older row shapes while columns are missing.
--
-- No personal data: a channel name, a medium, a campaign tag, a landing PATH. Never the IP or the UA.

-- 1. funnel_events: the in-app browser guess (Instagram, TikTok, ... from the User-Agent, name only),
-- used when a visit has no utm_source and no referrer; plus first-touch on checkout_created / paid.
alter table public.funnel_events add column if not exists in_app_source text;
alter table public.funnel_events add column if not exists first_touch_source text;
alter table public.funnel_events add column if not exists first_touch_medium text;
alter table public.funnel_events add column if not exists first_touch_campaign text;
alter table public.funnel_events add column if not exists first_touch_landing text;

-- 2. reservations and profiles: first-touch of the browser at signup / checkout.
alter table public.reservations add column if not exists first_touch_source text;
alter table public.reservations add column if not exists first_touch_medium text;
alter table public.reservations add column if not exists first_touch_campaign text;
alter table public.reservations add column if not exists first_touch_landing text;

alter table public.profiles add column if not exists first_touch_source text;
alter table public.profiles add column if not exists first_touch_medium text;
alter table public.profiles add column if not exists first_touch_campaign text;
alter table public.profiles add column if not exists first_touch_landing text;

-- 3. Length guards (drop-then-add keeps this re-runnable).
alter table public.funnel_events drop constraint if exists funnel_events_first_touch_check;
alter table public.funnel_events add constraint funnel_events_first_touch_check check (
  (in_app_source is null or char_length(in_app_source) between 1 and 60)
  and (first_touch_source is null or char_length(first_touch_source) between 1 and 100)
  and (first_touch_medium is null or char_length(first_touch_medium) between 1 and 100)
  and (first_touch_campaign is null or char_length(first_touch_campaign) between 1 and 100)
  and (first_touch_landing is null or (char_length(first_touch_landing) between 1 and 120 and first_touch_landing like '/%'))
);
alter table public.reservations drop constraint if exists reservations_first_touch_check;
alter table public.reservations add constraint reservations_first_touch_check check (
  (first_touch_source is null or char_length(first_touch_source) between 1 and 100)
  and (first_touch_medium is null or char_length(first_touch_medium) between 1 and 100)
  and (first_touch_campaign is null or char_length(first_touch_campaign) between 1 and 100)
  and (first_touch_landing is null or (char_length(first_touch_landing) between 1 and 120 and first_touch_landing like '/%'))
);
alter table public.profiles drop constraint if exists profiles_first_touch_check;
alter table public.profiles add constraint profiles_first_touch_check check (
  (first_touch_source is null or char_length(first_touch_source) between 1 and 100)
  and (first_touch_medium is null or char_length(first_touch_medium) between 1 and 100)
  and (first_touch_campaign is null or char_length(first_touch_campaign) between 1 and 100)
  and (first_touch_landing is null or (char_length(first_touch_landing) between 1 and 120 and first_touch_landing like '/%'))
);

-- 4. Access stays server-only (same as schema.sql / 2026-11-03-traffic.sql / 2026-11-04-app.sql).
alter table public.funnel_events enable row level security;
alter table public.reservations enable row level security;
alter table public.profiles enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;
-- profiles keeps its owner policies and grants from 2026-11-04-app.sql (a user can only see their own row,
-- and first-touch is just a channel name), so no grant change is needed for the new columns.

notify pgrst, 'reload schema';
