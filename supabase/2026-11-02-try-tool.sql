-- Free /try tool: daily run limits + global cost cap, and the three new funnel events.
-- Idempotent and additive: safe to run again, in any order relative to other funnel_events migrations
-- (run it LAST if another migration also rewrites funnel_events_event_check with a fixed list).
-- No personal data: ip_hash / session_hash are HMACs (server salt + UTC day) computed by the app.
-- Until this is applied /api/try fails closed ("temporarily unavailable"): the limits live here, not in memory.

create table if not exists public.try_runs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  day date not null default ((now() at time zone 'utc')::date),
  ip_hash text not null check (char_length(ip_hash) between 8 and 128),
  session_hash text not null check (char_length(session_hash) between 8 and 128),
  kind text not null check (kind in ('profile', 'opener', 'reply')),
  status text not null default 'counted' check (status in ('counted', 'released'))
);

-- Spend (input-token equivalents: input + 5 x output) of runs that reached the model. Releasing a run
-- (model never ran) flips status but never touches this, so the daily spend cap cannot be refunded.
alter table public.try_runs add column if not exists tokens bigint not null default 0;

create index if not exists try_runs_day_idx on public.try_runs (day, status);
create index if not exists try_runs_day_ip_idx on public.try_runs (day, ip_hash);
create index if not exists try_runs_day_session_idx on public.try_runs (day, session_hash);

alter table public.try_runs enable row level security;
revoke all on public.try_runs from public, anon, authenticated;
revoke all on public.try_runs from service_role;
grant select on public.try_runs to service_role;

-- Atomic check-and-count. The advisory lock serialises concurrent claims for the same UTC day,
-- so the global cap cannot be overshot by parallel requests. Also drops rows older than 14 days.
drop function if exists public.try_claim_run(text, text, text, int, int, int);

create or replace function public.try_claim_run(
  p_ip_hash text,
  p_session_hash text,
  p_kind text,
  p_session_limit int,
  p_ip_limit int,
  p_daily_cap int,
  p_token_cap bigint
)
returns table (allowed boolean, reason text, run_id bigint, session_remaining int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_session int;
  v_ip int;
  v_daily int;
  v_tokens bigint;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtext('try_runs:' || v_day::text));
  delete from public.try_runs where day < v_day - 14;

  select count(*) into v_session from public.try_runs where day = v_day and status = 'counted' and session_hash = p_session_hash;
  select count(*) into v_ip from public.try_runs where day = v_day and status = 'counted' and ip_hash = p_ip_hash;
  select count(*) into v_daily from public.try_runs where day = v_day and status = 'counted';
  select coalesce(sum(tokens), 0) into v_tokens from public.try_runs where day = v_day;

  if v_session >= p_session_limit then
    return query select false, 'session'::text, null::bigint, 0;
    return;
  end if;
  if v_ip >= p_ip_limit then
    return query select false, 'ip'::text, null::bigint, 0;
    return;
  end if;
  if v_daily >= p_daily_cap or v_tokens >= p_token_cap then
    return query select false, 'cap'::text, null::bigint, 0;
    return;
  end if;

  insert into public.try_runs (day, ip_hash, session_hash, kind)
  values (v_day, p_ip_hash, p_session_hash, p_kind)
  returning id into v_id;

  return query select true, null::text, v_id, p_session_limit - v_session - 1;
end;
$$;

create or replace function public.try_release_run(p_run_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.try_runs set status = 'released' where id = p_run_id;
$$;

create or replace function public.try_record_usage(p_run_id bigint, p_tokens bigint)
returns void
language sql
security definer
set search_path = public
as $$
  update public.try_runs set tokens = tokens + greatest(p_tokens, 0) where id = p_run_id;
$$;

revoke all on function public.try_claim_run(text, text, text, int, int, int, bigint) from public, anon, authenticated;
grant execute on function public.try_claim_run(text, text, text, int, int, int, bigint) to service_role;
revoke all on function public.try_record_usage(bigint, bigint) from public, anon, authenticated;
grant execute on function public.try_record_usage(bigint, bigint) to service_role;
revoke all on function public.try_release_run(bigint) from public, anon, authenticated;
grant execute on function public.try_release_run(bigint) to service_role;

-- Funnel events: add try_start, try_result, try_cta_click to whatever the constraint allows today.
do $$
declare
  v_def text;
  v_events text[];
  v_new text[] := array['try_start', 'try_result', 'try_cta_click'];
  v_item text;
begin
  select pg_get_constraintdef(oid) into v_def
  from pg_constraint
  where conrelid = 'public.funnel_events'::regclass and conname = 'funnel_events_event_check';

  select coalesce(array_agg(distinct m[1]), '{}') into v_events
  from regexp_matches(coalesce(v_def, ''), '''([a-z_0-9]+)''', 'g') as m;

  if v_events = '{}' then
    v_events := array['page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete', 'checkout_created', 'paid', 'checkout_canceled'];
  end if;

  foreach v_item in array v_new loop
    if not (v_item = any (v_events)) then
      v_events := v_events || v_item;
    end if;
  end loop;

  alter table public.funnel_events drop constraint if exists funnel_events_event_check;
  execute format(
    'alter table public.funnel_events add constraint funnel_events_event_check check (event in (%s))',
    (select string_agg(quote_literal(e), ', ' order by e) from unnest(v_events) as e)
  );
end
$$;

notify pgrst, 'reload schema';
