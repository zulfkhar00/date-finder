-- Funnel report. Read-only; run in the Supabase SQL editor (as postgres or service_role).
-- Requires 2026-10-23-funnel-tracking.sql. A "visitor" is one browser tab session (session_id).

-- 1. Daily counts per event (UTC days), last 30 days.
select
  date_trunc('day', created_at)::date as day,
  count(*) filter (where event = 'page_view')         as page_view,
  count(*) filter (where event = 'reserve_start')     as reserve_start,
  count(*) filter (where event = 'checkout_created')  as checkout_created,
  count(*) filter (where event = 'checkout_canceled') as checkout_canceled,
  count(*) filter (where event = 'paid')              as paid,
  count(distinct session_id)                          as visitors
from public.funnel_events
where created_at >= now() - interval '30 days'
group by 1
order by 1 desc;

-- 2. Visitor -> paid conversion by variant and utm_campaign (all time).
-- Each session is attributed to the variant/campaign on its first event.
with first_touch as (
  select distinct on (session_id)
    session_id,
    coalesce(variant, 'noswipe') as variant,
    coalesce(utm_campaign, '(none)') as utm_campaign
  from public.funnel_events
  where session_id is not null
  order by session_id, created_at
),
per_session as (
  select
    f.session_id,
    f.variant,
    f.utm_campaign,
    bool_or(e.event = 'reserve_start')    as started,
    bool_or(e.event = 'checkout_created') as checkout,
    bool_or(e.event = 'paid')             as paid
  from first_touch f
  join public.funnel_events e on e.session_id = f.session_id
  group by f.session_id, f.variant, f.utm_campaign
)
select
  variant,
  utm_campaign,
  count(*)                                   as visitors,
  count(*) filter (where started)            as reserve_starts,
  count(*) filter (where checkout)           as checkouts,
  count(*) filter (where paid)               as paid,
  round(100.0 * count(*) filter (where paid) / nullif(count(*), 0), 2) as visitor_to_paid_pct
from per_session
group by variant, utm_campaign
order by visitors desc;

-- 3. Cross-check against the source of truth: paid reservations by attribution.
select
  coalesce(variant, 'noswipe') as variant,
  coalesce(utm_source, '(none)') as utm_source,
  coalesce(utm_campaign, '(none)') as utm_campaign,
  count(*) as paid_reservations
from public.reservations
where status = 'paid'
group by 1, 2, 3
order by paid_reservations desc;
