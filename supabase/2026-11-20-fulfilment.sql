-- Done-for-you fulfilment: per-app workflow statuses, the reason a client sees, and an audit log of every status change,
-- operator note and ops alert. Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql and 2026-11-20-reports.sql.
-- Do not run against production without the founders' yes.
--
-- The app keeps working before this is applied: the old statuses (setting_up, live, paused) still save, Home reads the new
-- columns tolerantly, and the admin queue shows a setup notice for the log.
--
-- Access model: app_accounts is readable by its owner (own-rows policy), so the ONLY new columns on it are things the client is
-- meant to read: client_action_reason (what we need from them) and status_changed_at. Operator notes live in fulfilment_events,
-- which is SERVER ONLY (RLS on, every browser role revoked, service role only).

-- 1. app_accounts: status values are a superset of the current check ('setting_up', 'live', 'paused').
--   setting_up -> needs_client_action -> active -> paused -> closed.  'live' is the older name for 'active' and stays valid.
alter table public.app_accounts add column if not exists client_action_reason text;
alter table public.app_accounts add column if not exists status_changed_at timestamptz;

alter table public.app_accounts drop constraint if exists app_accounts_status_check;
alter table public.app_accounts add constraint app_accounts_status_check check (
  status in ('setting_up', 'needs_client_action', 'active', 'live', 'paused', 'closed')
);
alter table public.app_accounts drop constraint if exists app_accounts_reason_check;
alter table public.app_accounts add constraint app_accounts_reason_check check (
  client_action_reason is null or char_length(client_action_reason) between 1 and 200
);

-- 2. Audit log. One row per status change ('status'), operator note ('note') or ops alert ('alert').
--   actor is the admin's email, or 'automation' for the worker API, or 'system' for the alert sweep.
--   dedupe_key is unique so two overlapping cron runs claim one alert per client per day: alert:<user id>:<UTC date>.
create table if not exists public.fulfilment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  from_status text,
  to_status text,
  reason text,
  note text,
  dedupe_key text
);
create index if not exists fulfilment_events_user_idx on public.fulfilment_events (user_id, at desc);
create unique index if not exists fulfilment_events_dedupe_idx on public.fulfilment_events (dedupe_key) where dedupe_key is not null;

alter table public.fulfilment_events drop constraint if exists fulfilment_events_check;
alter table public.fulfilment_events add constraint fulfilment_events_check check (
  action in ('status', 'note', 'alert')
  and (app is null or app in ('tinder', 'hinge', 'bumble'))
  and char_length(actor) between 1 and 254
  and (reason is null or char_length(reason) <= 200)
  and (note is null or char_length(note) <= 2000)
);

-- 3. Server only.
alter table public.fulfilment_events enable row level security;
revoke all on public.fulfilment_events from public, anon, authenticated;
grant select, insert, delete on public.fulfilment_events to service_role;

notify pgrst, 'reload schema';
