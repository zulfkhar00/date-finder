-- Stage 1 concierge pilot: clients, tracker snapshots, AI drafts, Telegram update dedupe.
-- Idempotent: safe to run more than once. Run after schema.sql in the Supabase SQL editor.
-- No browser role receives access. Only the server's secret key (service_role) is used.
-- No screenshot or photo is ever stored: drafts keep only a short text summary of the input.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reservation_id uuid references public.reservations (id) on delete set null,
  telegram_chat_id bigint unique,
  name text not null check (char_length(name) between 1 and 120),
  voice_notes text not null default '' check (char_length(voice_notes) <= 4000),
  apps text[] not null default '{}',
  status text not null default 'pilot' check (status in ('pilot', 'paused', 'done')),
  invite_code text unique check (invite_code is null or invite_code ~ '^[A-Z2-9]{8}$'),
  invite_expires_at timestamptz,
  linked_at timestamptz
);

create index if not exists clients_status_created_idx on public.clients (status, created_at);

create table if not exists public.client_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  matches_week integer check (matches_week is null or matches_week >= 0),
  convos integer check (convos is null or convos >= 0),
  dates_scheduled integer check (dates_scheduled is null or dates_scheduled >= 0),
  note text check (note is null or char_length(note) <= 500)
);

create index if not exists client_events_client_created_idx on public.client_events (client_id, created_at);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('profile', 'opener', 'reply', 'date_plan')),
  input_summary text not null default '' check (char_length(input_summary) <= 1000),
  output jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'sending', 'rejected', 'sent_to_client', 'failed')),
  operator_note text check (operator_note is null or char_length(operator_note) <= 2000),
  decided_at timestamptz,
  decided_by text,
  sent_at timestamptz
);

-- 'sending' = one request owns the Telegram call (claimed with a conditional update), so a draft
-- can't be delivered twice. Re-created idempotently so older installs pick up the new value.
alter table public.drafts add column if not exists send_started_at timestamptz;
alter table public.drafts drop constraint if exists drafts_status_check;
alter table public.drafts add constraint drafts_status_check
  check (status in ('pending', 'approved', 'edited', 'sending', 'rejected', 'sent_to_client', 'failed'));

create index if not exists drafts_status_created_idx on public.drafts (status, created_at);
create index if not exists drafts_client_created_idx on public.drafts (client_id, created_at);
create index if not exists drafts_created_idx on public.drafts (created_at);

-- Telegram retries a webhook delivery until it gets a 2xx. One row per update_id makes the
-- handler idempotent. Rows hold no message content.
create table if not exists public.telegram_updates (
  update_id bigint primary key,
  received_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.client_events enable row level security;
alter table public.drafts enable row level security;
alter table public.telegram_updates enable row level security;

revoke all on public.clients, public.client_events, public.drafts, public.telegram_updates from public, anon, authenticated;
revoke all on public.clients, public.client_events, public.drafts, public.telegram_updates from service_role;
grant select, insert, update on public.clients to service_role;
grant select, insert on public.client_events to service_role;
grant select, insert, update on public.drafts to service_role;
grant select, insert, delete on public.telegram_updates to service_role;

-- Retention: drafts (input summary, draft text, operator notes) are kept for 30 days, then deleted.
-- service_role has no delete on drafts, so this definer function is the only way rows go away.
-- Run it daily: from pg_cron (see DEPLOYMENT.md) or by hand in the SQL editor:
--   select public.purge_old_drafts();
create or replace function public.purge_old_drafts(retain interval default interval '30 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if retain < interval '1 day' then
    raise exception 'retain must be at least 1 day';
  end if;
  delete from public.drafts where created_at < now() - retain;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_old_drafts(interval) from public, anon, authenticated;
grant execute on function public.purge_old_drafts(interval) to service_role;

notify pgrst, 'reload schema';
