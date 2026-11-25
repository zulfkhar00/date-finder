-- "Your starter pack": profile rewrite, photo order, openers, reply templates and a first-date plan,
-- written by the model for every onboarded user. Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql.
-- Do not run against production without the founders' yes.
--
-- Access model (same as the rest of the app): the Next.js server writes with the service role; signed-in users
-- (role `authenticated`) can SELECT their own pack only; anon and browsers get nothing else. The `drafts` table is the
-- concierge's (client_id based) and does not fit, so packs get their own table.
--
-- No photo, screenshot or prompt is ever stored here. `content` is the model's finished output (profile text, openers,
-- a date plan, and the ids of the user's own photos in the order we suggest). `last_error` holds a short code only.

create table if not exists public.starter_packs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version integer not null default 1,
  -- pending: waiting for a slot (first try, backoff, or the daily cap); generating: leased by a worker;
  -- ready: content is there; failed: three tries in one run failed, the sweep tries again later.
  status text not null default 'pending',
  content jsonb,
  attempts integer not null default 0,
  last_error text,
  tokens bigint not null default 0,
  model text,
  lease_until timestamptz,
  next_attempt_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One pack per user per version: a double trigger (cron + onboarding + admin) cannot create two.
  unique (user_id, version)
);
create index if not exists starter_packs_status_idx on public.starter_packs (status, next_attempt_at);

alter table public.starter_packs drop constraint if exists starter_packs_status_check;
alter table public.starter_packs add constraint starter_packs_status_check check (status in ('pending', 'generating', 'ready', 'failed'));

-- Spend ledger: one row per run that reached the generator. It drives the daily run cap, the daily token cap
-- (input tokens + 5 x output tokens) and the 3-per-day regenerate limit. user_id is set null (not cascaded) when
-- an account is deleted, so deleting an account never refunds the day's spend.
create table if not exists public.starter_pack_runs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  day date not null default ((now() at time zone 'utc')::date),
  kind text not null default 'auto' check (kind in ('auto', 'regenerate', 'admin')),
  tokens bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists starter_pack_runs_day_idx on public.starter_pack_runs (day);
create index if not exists starter_pack_runs_user_day_idx on public.starter_pack_runs (user_id, day, kind);

alter table public.starter_packs enable row level security;
alter table public.starter_pack_runs enable row level security;

revoke all on public.starter_packs, public.starter_pack_runs from public, anon, authenticated;
grant select, insert, update, delete on public.starter_packs to service_role;
grant select, insert, update, delete on public.starter_pack_runs to service_role;
grant usage, select on sequence public.starter_pack_runs_id_seq to service_role;
-- Users read their own pack. Nothing else; the runs ledger is server-only.
grant select on public.starter_packs to authenticated;

drop policy if exists starter_packs_own_select on public.starter_packs;
create policy starter_packs_own_select on public.starter_packs for select to authenticated
  using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
