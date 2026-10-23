-- Admin dashboard: lead notes + read-only report functions. Run after schema.sql and
-- 2026-10-23-funnel-tracking.sql. Idempotent: safe to run again.
-- Only service_role (the server's secret key) can read or write any of this. The /admin pages
-- check the signed-in email against ADMIN_EMAILS before they call it.

-- 1. One row per reservation: pipeline stage + free-text notes written by an admin.
create table if not exists public.lead_notes (
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  stage text not null default 'new',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.lead_notes drop constraint if exists lead_notes_stage_check;
alter table public.lead_notes add constraint lead_notes_stage_check check (stage in ('new', 'contacted', 'pilot', 'declined'));
alter table public.lead_notes drop constraint if exists lead_notes_notes_len;
alter table public.lead_notes add constraint lead_notes_notes_len check (char_length(notes) <= 5000);
alter table public.lead_notes drop constraint if exists lead_notes_updated_by_len;
alter table public.lead_notes add constraint lead_notes_updated_by_len check (updated_by is null or char_length(updated_by) between 3 and 254);

create index if not exists lead_notes_stage_idx on public.lead_notes (stage);
create index if not exists reservations_created_idx on public.reservations (created_at desc);
create index if not exists reservations_paid_at_idx on public.reservations (paid_at) where status = 'paid';

alter table public.lead_notes enable row level security;

revoke all on public.lead_notes from public, anon, authenticated;
revoke all on public.lead_notes from service_role;
grant select, insert, update on public.lead_notes to service_role;

-- 2. Funnel by first touch. A visitor is one browser tab session (funnel_events.session_id),
-- attributed to the variant/campaign on its first event, same as supabase/funnel.sql.
-- p_since = null means all time.
create or replace function public.admin_funnel_summary(p_since timestamptz default null)
returns table (
  variant text,
  utm_campaign text,
  visitors bigint,
  reserve_starts bigint,
  checkouts bigint,
  paid bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with events as (
    select e.session_id, e.event, e.variant, e.utm_campaign, e.created_at
    from public.funnel_events e
    where e.session_id is not null
      and (p_since is null or e.created_at >= p_since)
  ),
  first_touch as (
    select distinct on (session_id)
      session_id,
      coalesce(variant, 'premium') as variant,
      coalesce(utm_campaign, '(none)') as utm_campaign
    from events
    order by session_id, created_at
  ),
  per_session as (
    select
      f.variant,
      f.utm_campaign,
      bool_or(e.event = 'reserve_start') as started,
      bool_or(e.event = 'checkout_created') as checkout,
      bool_or(e.event = 'paid') as paid
    from first_touch f
    join events e on e.session_id = f.session_id
    group by f.session_id, f.variant, f.utm_campaign
  )
  select
    variant,
    utm_campaign,
    count(*) as visitors,
    count(*) filter (where started) as reserve_starts,
    count(*) filter (where checkout) as checkouts,
    count(*) filter (where paid) as paid
  from per_session
  group by variant, utm_campaign
  order by visitors desc;
$$;

-- 3. Daily series (UTC days) for the last p_days days: page views and visitor sessions from
-- funnel_events, paid reservations from reservations.paid_at. Days without data are omitted.
create or replace function public.admin_daily(p_days integer default 30)
returns table (
  day date,
  page_views bigint,
  visitors bigint,
  paid bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with bounds as (
    select ((now() at time zone 'utc')::date - (least(greatest(coalesce(p_days, 30), 1), 366) - 1)) as first_day
  ),
  views as (
    select (e.created_at at time zone 'utc')::date as day,
      count(*) filter (where e.event = 'page_view') as page_views,
      count(distinct e.session_id) as visitors
    from public.funnel_events e, bounds b
    where e.created_at >= (b.first_day::timestamp at time zone 'utc')
    group by 1
  ),
  paid as (
    select (r.paid_at at time zone 'utc')::date as day, count(*) as paid
    from public.reservations r, bounds b
    where r.status = 'paid' and r.paid_at >= (b.first_day::timestamp at time zone 'utc')
    group by 1
  )
  select
    coalesce(v.day, p.day) as day,
    coalesce(v.page_views, 0) as page_views,
    coalesce(v.visitors, 0) as visitors,
    coalesce(p.paid, 0) as paid
  from views v
  full join paid p on p.day = v.day
  order by 1;
$$;

-- 4. Distinct values for the leads filters. Null variant means the original premium page.
create or replace function public.admin_lead_facets()
returns table (kind text, value text, reservations bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select 'variant', coalesce(r.variant, 'premium'), count(*)
  from public.reservations r
  group by 2
  union all
  select 'utm_campaign', coalesce(r.utm_campaign, '(none)'), count(*)
  from public.reservations r
  group by 2
  order by 1, 3 desc;
$$;

revoke all on function public.admin_funnel_summary(timestamptz) from public, anon, authenticated;
revoke all on function public.admin_daily(integer) from public, anon, authenticated;
revoke all on function public.admin_lead_facets() from public, anon, authenticated;
grant execute on function public.admin_funnel_summary(timestamptz) to service_role;
grant execute on function public.admin_daily(integer) to service_role;
grant execute on function public.admin_lead_facets() to service_role;

notify pgrst, 'reload schema';
