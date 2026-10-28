-- Full funnel + IG reel `ref`. Run after 2026-10-23-funnel-tracking.sql. Idempotent: safe to run again.
-- The app keeps working before this is applied: `ref` inserts fall back without the column, and
-- the two new browser events (get_started, onboarding_complete) are rejected by the old check and
-- only logged, so the other funnel rows and checkout are unaffected.

-- 1. New funnel steps: page_view -> get_started -> reserve_start -> onboarding_complete -> checkout_created -> paid.
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in ('page_view', 'get_started', 'reserve_start', 'onboarding_complete', 'checkout_created', 'paid', 'checkout_canceled'));

-- 2. `ref` (IG reel id or short source tag from ?ref=) on funnel events and on each reservation.
alter table public.funnel_events add column if not exists ref text;
alter table public.funnel_events drop constraint if exists funnel_events_ref_format;
alter table public.funnel_events add constraint funnel_events_ref_format check (ref is null or ref ~ '^[A-Za-z0-9_-]{1,64}$');

alter table public.reservations add column if not exists ref text;
alter table public.reservations drop constraint if exists reservations_ref_format;
alter table public.reservations add constraint reservations_ref_format check (ref is null or ref ~ '^[A-Za-z0-9_-]{1,64}$');

create index if not exists funnel_events_ref_idx on public.funnel_events (ref, event);
create index if not exists reservations_ref_idx on public.reservations (ref);

-- 3. Access stays server-only (same as schema.sql / funnel-tracking.sql).
alter table public.funnel_events enable row level security;
alter table public.reservations enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;

notify pgrst, 'reload schema';
