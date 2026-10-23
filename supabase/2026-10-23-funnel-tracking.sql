-- Funnel tracking + UTM attribution. Run after schema.sql. Idempotent: safe to run again.
-- The app keeps working before this is applied (inserts fall back and log), so it can be run
-- before or after the deploy.

-- 1. Attribution on each reservation (first-touch, captured in the browser). All nullable.
alter table public.reservations add column if not exists utm_source text;
alter table public.reservations add column if not exists utm_medium text;
alter table public.reservations add column if not exists utm_campaign text;
alter table public.reservations add column if not exists utm_content text;
alter table public.reservations add column if not exists utm_term text;
alter table public.reservations add column if not exists variant text;
alter table public.reservations add column if not exists referrer text;

alter table public.reservations drop constraint if exists reservations_utm_source_len;
alter table public.reservations add constraint reservations_utm_source_len check (utm_source is null or char_length(utm_source) between 1 and 200);
alter table public.reservations drop constraint if exists reservations_utm_medium_len;
alter table public.reservations add constraint reservations_utm_medium_len check (utm_medium is null or char_length(utm_medium) between 1 and 200);
alter table public.reservations drop constraint if exists reservations_utm_campaign_len;
alter table public.reservations add constraint reservations_utm_campaign_len check (utm_campaign is null or char_length(utm_campaign) between 1 and 200);
alter table public.reservations drop constraint if exists reservations_utm_content_len;
alter table public.reservations add constraint reservations_utm_content_len check (utm_content is null or char_length(utm_content) between 1 and 200);
alter table public.reservations drop constraint if exists reservations_utm_term_len;
alter table public.reservations add constraint reservations_utm_term_len check (utm_term is null or char_length(utm_term) between 1 and 200);
alter table public.reservations drop constraint if exists reservations_variant_format;
alter table public.reservations add constraint reservations_variant_format check (variant is null or variant ~ '^[a-z0-9][a-z0-9_-]{0,31}$');
alter table public.reservations drop constraint if exists reservations_referrer_len;
alter table public.reservations add constraint reservations_referrer_len check (referrer is null or char_length(referrer) between 1 and 255);

create index if not exists reservations_variant_campaign_idx on public.reservations (variant, utm_campaign);

-- 2. Funnel events. No personal data: a random per-tab session id, the event, variant, campaign.
-- dedupe_key makes server-side events (checkout_created, paid) idempotent across Stripe retries.
create table if not exists public.funnel_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text check (session_id is null or char_length(session_id) between 1 and 64),
  event text not null check (event in ('page_view', 'reserve_start', 'checkout_created', 'paid', 'checkout_canceled')),
  variant text check (variant is null or variant ~ '^[a-z0-9][a-z0-9_-]{0,31}$'),
  utm_campaign text check (utm_campaign is null or char_length(utm_campaign) between 1 and 200),
  dedupe_key text unique check (dedupe_key is null or char_length(dedupe_key) between 1 and 300)
);

create index if not exists funnel_events_created_idx on public.funnel_events (created_at);
create index if not exists funnel_events_event_created_idx on public.funnel_events (event, created_at);
create index if not exists funnel_events_session_idx on public.funnel_events (session_id);

alter table public.funnel_events enable row level security;

revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.funnel_events from service_role;
grant select, insert on public.funnel_events to service_role;

notify pgrst, 'reload schema';
