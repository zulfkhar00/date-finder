-- Checkout forensics: why people who open checkout do not pay. Idempotent: safe to run again, in any
-- order relative to the other funnel_events migrations. Additive only: nothing is dropped or rewritten,
-- existing rows keep NULL in the new columns. Run after schema.sql and 2026-10-23-funnel-tracking.sql.
-- The app keeps working before this is applied (inserts fall back to the older row shapes and log);
-- until the event constraint below is in, /api/event answers 503 (X-Funnel-Error 23514) for the new
-- checkout_* / payment_* events only, and the webhook diagnostics are skipped with a logged code.
--
-- Check first (a NULL country/device on every row usually means 2026-11-03-traffic.sql was never run):
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'funnel_events' and column_name in ('device', 'country', 'detail');
--
-- No personal data: detail holds short machine tokens only (Stripe error code, decline code, card brand,
-- card country, funding, seconds, the Checkout Session id). Never a card number, name, email or IP.

-- 1. Traffic columns (same as 2026-11-03-traffic.sql, repeated so one file is enough). All nullable.
alter table public.funnel_events add column if not exists utm_source text;
alter table public.funnel_events add column if not exists utm_medium text;
alter table public.funnel_events add column if not exists utm_content text;
alter table public.funnel_events add column if not exists referrer_host text;
alter table public.funnel_events add column if not exists landing_path text;
alter table public.funnel_events add column if not exists device text;
alter table public.funnel_events add column if not exists country text;

alter table public.funnel_events drop constraint if exists funnel_events_traffic_check;
alter table public.funnel_events add constraint funnel_events_traffic_check check (
  (utm_source is null or char_length(utm_source) between 1 and 200)
  and (utm_medium is null or char_length(utm_medium) between 1 and 200)
  and (utm_content is null or char_length(utm_content) between 1 and 200)
  and (referrer_host is null or char_length(referrer_host) between 1 and 100)
  and (landing_path is null or (char_length(landing_path) between 1 and 120 and landing_path like '/%'))
  and (device is null or device in ('mobile', 'tablet', 'desktop', 'bot'))
  and (country is null or country ~ '^[A-Z]{2}$')
);

-- 2. Checkout diagnostics detail (JSON object, small), and the last failure on the reservation.
alter table public.funnel_events add column if not exists detail jsonb;
alter table public.funnel_events drop constraint if exists funnel_events_detail_check;
alter table public.funnel_events add constraint funnel_events_detail_check check (
  detail is null or (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 1024)
);

alter table public.reservations add column if not exists last_payment_error text;
alter table public.reservations drop constraint if exists reservations_last_payment_error_len;
alter table public.reservations add constraint reservations_last_payment_error_len check (
  last_payment_error is null or char_length(last_payment_error) between 1 and 100
);

-- 3. New event names. Keeps every name already allowed in prod (2026-11-11-resume-card-events.sql) and adds:
--   browser: checkout_form_ready, checkout_form_error, payment_submit, payment_error, checkout_closed
--   Stripe webhook: stripe_payment_failed, stripe_session_expired
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in (
    'page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete',
    'checkout_created', 'paid', 'checkout_canceled',
    'try_cta_click', 'try_result', 'try_start',
    'ob_code_sent', 'ob_apps', 'ob_about', 'ob_type', 'ob_photos', 'ob_consent', 'ob_pay',
    'resume_card_view', 'resume_card_click',
    'checkout_form_ready', 'checkout_form_error', 'payment_submit', 'payment_error', 'checkout_closed',
    'stripe_payment_failed', 'stripe_session_expired'
  ));

-- 4. Access stays server-only (same as schema.sql / funnel-tracking.sql).
alter table public.funnel_events enable row level security;
alter table public.reservations enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;

notify pgrst, 'reload schema';
