-- Done-for-you accounts: NoSwipe runs the client's own Hinge / Tinder / Bumble (with consent) on a dedicated phone, driven by the phone rig
-- (repo edge-phone-agent). This adds: the per-app consent + handoff method, the "waiting for login" state, the activity feed the rig
-- writes to, the operator's phone assignment, and the client's confirm/decline on a booked date.
-- Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql and 2026-11-20-fulfilment.sql.
-- Do not run against production without the founders' yes.
--
-- The app keeps working before this is applied: Home reads the new columns tolerantly, an empty or missing feed reads as "no activity yet",
-- and the admin Run panel shows a setup notice.
--
-- Access model
--   * app_accounts / dates / takeovers are readable by their owner, so the only new columns on them are things the client is meant to read.
--   * account_activity: the client reads their own rows (RLS own-select); only the server (service role) writes. The phone rig writes through
--     POST /api/automation/v1/activity with AUTOMATION_API_KEY, never straight to the database.
--   * account_runs (which phone, which internal account label) is SERVER ONLY: RLS on, every browser role revoked.
--   * No credentials, no message text and no screenshots are stored anywhere here.

-- 1. app_accounts: waiting-for-login state, handoff method, per-app consent ---------------------------------------------------------
--   awaiting_login -> setting_up -> active -> paused -> closed, with needs_client_action at any point (e.g. the app asks the client to verify).
alter table public.app_accounts add column if not exists handoff_method text;
alter table public.app_accounts add column if not exists consented_at timestamptz;
alter table public.app_accounts add column if not exists consent_version text;
alter table public.app_accounts add column if not exists login_scheduled_at timestamptz;

alter table public.app_accounts drop constraint if exists app_accounts_status_check;
alter table public.app_accounts add constraint app_accounts_status_check check (
  status in ('awaiting_login', 'setting_up', 'needs_client_action', 'active', 'live', 'paused', 'closed')
);
alter table public.app_accounts drop constraint if exists app_accounts_handoff_check;
alter table public.app_accounts add constraint app_accounts_handoff_check check (
  handoff_method is null or handoff_method in ('operator_session', 'invite')
);

-- 2. takeovers: who started it. 'app' = the client took over a whole app from Home; Resume hands those chats back. ----------------
alter table public.takeovers add column if not exists source text not null default 'chat';
alter table public.takeovers drop constraint if exists takeovers_source_check;
alter table public.takeovers add constraint takeovers_source_check check (source in ('chat', 'app'));

-- 3. dates: the rig's id for the date (so a replayed event never books twice) and the client's answer ------------------------------
alter table public.dates add column if not exists external_id text;
alter table public.dates add column if not exists client_response text not null default 'pending';
alter table public.dates add column if not exists responded_at timestamptz;
create unique index if not exists dates_external_idx on public.dates (user_id, external_id) where external_id is not null;
alter table public.dates drop constraint if exists dates_client_response_check;
alter table public.dates add constraint dates_client_response_check check (client_response in ('pending', 'confirmed', 'declined'));

-- 4. account_activity: what the rig did, one row per event. -------------------------------------------------------------------
--   kind: swipes (count = how many in this batch) | match | chat (one exchange in a chat; match_ref says which) | date_booked | needs_you.
--   idempotency_key: chosen by the rig, unique per client. A replay with the same key is a no-op, so a retry after a timeout never
--   double-counts. occurred_at is when it happened on the phone (UTC); the browser shows it in the client's own time zone.
create table if not exists public.account_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  kind text not null,
  count integer not null default 1,
  match_ref text,
  reason text,
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  idempotency_key text not null
);
create unique index if not exists account_activity_idem_idx on public.account_activity (user_id, idempotency_key);
create index if not exists account_activity_user_idx on public.account_activity (user_id, occurred_at desc);

alter table public.account_activity drop constraint if exists account_activity_check;
alter table public.account_activity add constraint account_activity_check check (
  app in ('tinder', 'hinge', 'bumble')
  and kind in ('swipes', 'match', 'chat', 'date_booked', 'needs_you')
  and count between 1 and 10000
  and char_length(idempotency_key) between 8 and 200
  and (match_ref is null or char_length(match_ref) <= 200)
  and (reason is null or char_length(reason) <= 200)
);

-- 5. account_runs: which phone and which internal account label run this client's app. SERVER ONLY. ----------------------------
create table if not exists public.account_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  phone_id text,
  account_ref text,
  updated_by text not null default 'system',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, app)
);
create index if not exists account_runs_phone_idx on public.account_runs (phone_id);
alter table public.account_runs drop constraint if exists account_runs_check;
alter table public.account_runs add constraint account_runs_check check (
  app in ('tinder', 'hinge', 'bumble')
  and (phone_id is null or char_length(phone_id) between 1 and 80)
  and (account_ref is null or char_length(account_ref) between 1 and 120)
);

-- 6. RLS and grants ---------------------------------------------------------------------------------------------------------------
alter table public.account_activity enable row level security;
alter table public.account_runs enable row level security;

revoke all on public.account_activity, public.account_runs from public, anon, authenticated;
grant select, insert, update, delete on public.account_activity to service_role;
grant select, insert, update, delete on public.account_runs to service_role;
-- The client reads their own activity. Nothing else: every write goes through the server.
grant select on public.account_activity to authenticated;
drop policy if exists account_activity_own_select on public.account_activity;
create policy account_activity_own_select on public.account_activity for select to authenticated using (user_id = (select auth.uid()));

notify pgrst, 'reload schema';
