-- Reply helper (Chats tab): the user shows a dating-app conversation (screenshots or pasted text) and gets three replies in
-- their own voice, a one-line read of the chat and, when it is time, a date suggestion. Idempotent and additive: safe to run again.
-- Run after 2026-11-04-app.sql and 2026-11-20-starter-packs.sql. Do not run against production without the founders' yes.
--
-- Access model (same as starter_packs): the Next.js server writes with the service role; signed-in users (role
-- `authenticated`) can SELECT their own threads only; anon and browsers get nothing else.
--
-- No screenshot is ever stored: images are read in memory by the request and dropped. `transcript` is the last <= 14 lines
-- the model read out of the chat (kept so "write it again" / "more playful" work without a new upload; the user can delete the
-- thread, and deleting the account cascades). `drafts` is the model's finished output. The admin sees counts only.

create table if not exists public.reply_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'screenshots',
  image_count smallint not null default 0,
  language text,
  read_line text,
  transcript jsonb not null default '[]'::jsonb,
  drafts jsonb not null,
  tweak text,
  runs integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reply_threads_user_idx on public.reply_threads (user_id, updated_at desc);

alter table public.reply_threads drop constraint if exists reply_threads_source_check;
alter table public.reply_threads add constraint reply_threads_source_check check (source in ('screenshots', 'text'));
alter table public.reply_threads drop constraint if exists reply_threads_tweak_check;
alter table public.reply_threads add constraint reply_threads_tweak_check check (tweak is null or tweak in ('playful', 'direct', 'shorter'));
alter table public.reply_threads drop constraint if exists reply_threads_image_count_check;
alter table public.reply_threads add constraint reply_threads_image_count_check check (image_count between 0 and 4);

-- Spend ledger: one row per run that reached the generator. It drives the daily run cap (REPLY_HELPER_DAILY_CAP), the daily
-- token cap (input tokens + 5 x output tokens) and the per-user limit (20 a day). finished_at is null while a run is in
-- flight, which is what refuses a double submit. user_id / thread_id are set null (not cascaded) when an account or a thread
-- is deleted, so deleting never refunds the day's spend.
create table if not exists public.reply_helper_runs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  thread_id uuid references public.reply_threads (id) on delete set null,
  day date not null default ((now() at time zone 'utc')::date),
  kind text not null default 'new',
  tokens bigint not null default 0,
  outcome text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists reply_helper_runs_day_idx on public.reply_helper_runs (day);
create index if not exists reply_helper_runs_user_day_idx on public.reply_helper_runs (user_id, day);
alter table public.reply_helper_runs drop constraint if exists reply_helper_runs_kind_check;
alter table public.reply_helper_runs add constraint reply_helper_runs_kind_check check (kind in ('new', 'regenerate', 'tweak'));

alter table public.reply_threads enable row level security;
alter table public.reply_helper_runs enable row level security;

revoke all on public.reply_threads, public.reply_helper_runs from public, anon, authenticated;
grant select, insert, update, delete on public.reply_threads to service_role;
grant select, insert, update, delete on public.reply_helper_runs to service_role;
grant usage, select on sequence public.reply_helper_runs_id_seq to service_role;
-- Users read their own threads. Nothing else; the runs ledger is server-only.
grant select on public.reply_threads to authenticated;

drop policy if exists reply_threads_own_select on public.reply_threads;
create policy reply_threads_own_select on public.reply_threads for select to authenticated
  using (user_id = (select auth.uid()));

-- Funnel events. Keeps every name already allowed in prod (the list in 2026-11-20-paid-country-gate.sql, the newest one that
-- defines this constraint) and adds, both written by the server (no user id, no content):
--   reply_helper_used (drafts were written), reply_copied (a draft was copied)
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in (
    'page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete',
    'checkout_created', 'paid', 'checkout_canceled',
    'try_cta_click', 'try_result', 'try_start',
    'ob_code_sent', 'ob_apps', 'ob_about', 'ob_type', 'ob_photos', 'ob_consent', 'ob_pay',
    'resume_card_view', 'resume_card_click',
    'checkout_form_ready', 'checkout_form_error', 'payment_submit', 'payment_error', 'checkout_closed',
    'stripe_payment_failed', 'stripe_session_expired',
    'checkout_blocked_country', 'paid_country_review',
    'reply_helper_used', 'reply_copied'
  ));
alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;

notify pgrst, 'reload schema';
