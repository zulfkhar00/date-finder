-- Visit quality for funnel analytics. Run after 2026-11-21-first-touch.sql.
-- Additive and idempotent: one nullable column and one check constraint (drop-then-add). Nothing is
-- rewritten or dropped; existing rows keep NULL = "legacy", which every report treats as human unless
-- the device says bot or the behaviour rule (one page view, no source, no interaction) says otherwise.
-- Safe to run before or after the deploy: /api/event falls back to the older row shape while the column is missing.
--
-- human   = nothing doubtful in the request.
-- suspect = no Accept-Language, a datacenter / anonymizing network, or (derived at read time) an unengaged
--           direct visit. Kept in the table; /admin counts it only with ?suspect=1.
-- bot     = crawler / automation user agent, no user agent, or a datacenter network that also hides its
--           language. Stored together with device = 'bot', which the reports already drop.
-- No personal data: a three-value label. Never the IP, the AS number or the user agent.

alter table public.funnel_events add column if not exists quality text;

alter table public.funnel_events drop constraint if exists funnel_events_quality_check;
alter table public.funnel_events add constraint funnel_events_quality_check check (quality is null or quality in ('human', 'suspect', 'bot'));

-- Reports that read a window of recent non-human traffic.
create index if not exists funnel_events_quality_created_idx on public.funnel_events (quality, created_at desc) where quality is not null and quality <> 'human';

-- Access stays server-only (same as schema.sql / 2026-11-03-traffic.sql).
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;

notify pgrst, 'reload schema';
