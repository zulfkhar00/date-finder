-- Operator side of done-for-you: the account kit (what to type into each app) and the creation checklist
-- (create -> verify -> photos -> filters -> phone -> first session). Idempotent and additive: safe to run again.
-- Run after 2026-11-20-fulfilment.sql and 2026-11-21-account-runs.sql.
--
-- Access model: both tables are SERVER ONLY (RLS on, every browser role revoked, service role only). The kit holds the client's
-- bio, photo order and preferences as a working copy for our team; the client never reads it and no credentials, messages or
-- screenshots are stored here. The checklist only records who ticked which step and when.

-- 1. account_kits: one working kit per client per app. sections is {bio, prompts, photos, filters, tone, dealbreakers, schedule},
--    each regenerated on its own. timezone is the client's IANA zone (set by the operator) so schedule windows read in their time.
create table if not exists public.account_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  sections jsonb not null default '{}'::jsonb,
  timezone text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text not null default 'system',
  unique (user_id, app)
);
alter table public.account_kits drop constraint if exists account_kits_check;
alter table public.account_kits add constraint account_kits_check check (
  app in ('tinder', 'hinge', 'bumble')
  and (timezone is null or char_length(timezone) between 1 and 64)
);

-- 2. account_checklist: one row per ticked step. Unticking deletes the row; the who/when history is in fulfilment_events.
create table if not exists public.account_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  step text not null,
  done_by text not null,
  done_at timestamptz not null default now(),
  unique (user_id, app, step)
);
create index if not exists account_checklist_user_idx on public.account_checklist (user_id);
alter table public.account_checklist drop constraint if exists account_checklist_check;
alter table public.account_checklist add constraint account_checklist_check check (
  app in ('tinder', 'hinge', 'bumble')
  and step in ('create_account', 'verify', 'upload_photos', 'set_filters', 'assign_phone', 'first_session')
  and char_length(done_by) between 1 and 254
);

-- 3. RLS and grants: server only.
alter table public.account_kits enable row level security;
alter table public.account_checklist enable row level security;
revoke all on public.account_kits, public.account_checklist from public, anon, authenticated;
grant select, insert, update, delete on public.account_kits to service_role;
grant select, insert, update, delete on public.account_checklist to service_role;

notify pgrst, 'reload schema';
