-- Live demo mode: an INTERNAL account (profiles.internal = true) can be switched into a simulated "NoSwipe is running my dating apps"
-- state so a founder can film the real app. Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql and
-- 2026-11-21-account-runs.sql. Do not run against production without the founders' yes.
--
-- What it adds
--   * `demo boolean` on matches, messages, dates and account_activity. Every row demo mode writes carries demo = true, so reset can
--     delete exactly those rows and nothing a real user or the rig wrote.
--   * demo_sessions: one row per internal account that has ever used demo mode (on/off, next action time, tick lock, daily LLM spend).
--     SERVER ONLY: RLS on, every browser role revoked, service role granted.
--   * A trigger that refuses to switch demo mode on for a profile that is not internal. A real user can never be put in demo mode,
--     whatever the application code does.
-- No photos, message text or credentials are stored here; persona photos live in the private profile-photos bucket under demo/.

-- 1. Tag columns -------------------------------------------------------------------------------------------------------------------
alter table public.matches add column if not exists demo boolean not null default false;
alter table public.messages add column if not exists demo boolean not null default false;
alter table public.dates add column if not exists demo boolean not null default false;
alter table public.account_activity add column if not exists demo boolean not null default false;

create index if not exists matches_demo_idx on public.matches (user_id) where demo;
create index if not exists messages_demo_idx on public.messages (user_id) where demo;
create index if not exists dates_demo_idx on public.dates (user_id) where demo;
create index if not exists account_activity_demo_idx on public.account_activity (user_id) where demo;

-- 2. demo_sessions -----------------------------------------------------------------------------------------------------------------
create table if not exists public.demo_sessions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  -- The simulation does one thing per tick, no sooner than this (random 10-40 s apart), so extra tabs or fast polling add nothing.
  next_action_at timestamptz not null default now(),
  -- Held for a few seconds while one tick runs; a second tab's tick finds it taken and does nothing.
  lock_until timestamptz,
  last_tick_at timestamptz,
  -- The viewer's IANA zone (from the page that ticks), so "Thursday 7pm" is the viewer's Thursday 7pm.
  timezone text,
  -- Model spend for the current UTC day, in millionths of a dollar. The service stops calling the model at the cap and uses canned lines.
  spent_day date not null default (now() at time zone 'utc')::date,
  spent_micro integer not null default 0,
  -- Apps this demo added to app_accounts (the user had not chosen them); reset removes only these.
  added_apps text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.demo_sessions add column if not exists timezone text;
alter table public.demo_sessions drop constraint if exists demo_sessions_check;
alter table public.demo_sessions add constraint demo_sessions_check check (spent_micro >= 0 and cardinality(added_apps) <= 3);

create or replace function public.demo_sessions_internal_only() returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.enabled and not exists (select 1 from public.profiles where user_id = new.user_id and internal) then
    raise exception 'demo mode is only available to internal accounts' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists demo_sessions_internal_only_trg on public.demo_sessions;
create trigger demo_sessions_internal_only_trg before insert or update on public.demo_sessions
  for each row execute function public.demo_sessions_internal_only();

revoke all on function public.demo_sessions_internal_only() from public, anon, authenticated;

-- 3. RLS and grants: server only ---------------------------------------------------------------------------------------------------
alter table public.demo_sessions enable row level security;
revoke all on public.demo_sessions from public, anon, authenticated;
grant select, insert, update, delete on public.demo_sessions to service_role;

notify pgrst, 'reload schema';
