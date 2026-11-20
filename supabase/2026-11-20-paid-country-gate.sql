-- Paid-country gate: the paid service is offered in US, CA, GB, AU and NZ only (PAID_COUNTRIES env; free tools work
-- everywhere). Idempotent and additive: safe to run again, in any order relative to the other funnel_events migrations.
-- Nothing is dropped or rewritten. Do not run against production without the founders' yes.
--
-- The app keeps working before this is applied: a payment from outside the list is still recorded as paid; the review
-- flag and the funnel event are skipped with a logged code, and until the event constraint below is in /api/event answers
-- 503 (X-Funnel-Error 23514) for checkout_blocked_country only.
--
-- A flagged payment is NEVER refunded or blocked by code. A person looks at reservations where country_review is not null:
--   select id, status, billing_country, country_review, created_at from public.reservations
--   where country_review is not null order by created_at desc;
-- No personal data is added: billing_country is two letters, country_review is a short token.

-- 1. Review flag on the reservation (both nullable; existing rows keep NULL).
--    billing_country_outside_list : Stripe's billing address country is not in the list
--    geo_country_outside_list     : no billing country on the session (opened before the gate), checkout was opened from outside the list
--    country_unknown              : neither is known
alter table public.reservations add column if not exists billing_country text;
alter table public.reservations add column if not exists country_review text;

alter table public.reservations drop constraint if exists reservations_billing_country_check;
alter table public.reservations add constraint reservations_billing_country_check check (
  billing_country is null or billing_country ~ '^[A-Z]{2}$'
);
alter table public.reservations drop constraint if exists reservations_country_review_check;
alter table public.reservations add constraint reservations_country_review_check check (
  country_review is null or country_review in ('billing_country_outside_list', 'geo_country_outside_list', 'country_unknown')
);
create index if not exists reservations_country_review_idx on public.reservations (created_at desc) where country_review is not null;

-- 2. Funnel events. The detail column (and its check) come from 2026-11-20-checkout-forensics.sql; repeated so one file is enough.
alter table public.funnel_events add column if not exists detail jsonb;
alter table public.funnel_events drop constraint if exists funnel_events_detail_check;
alter table public.funnel_events add constraint funnel_events_detail_check check (
  detail is null or (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 1024)
);

-- 3. New event names. Keeps every name already allowed in prod (2026-11-20-checkout-forensics.sql) and adds:
--   browser: checkout_blocked_country (the "not available in your country" message was shown instead of a payment form)
--   Stripe webhook: paid_country_review (a payment from outside the list was flagged for review)
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
    'checkout_blocked_country', 'paid_country_review'
  ));

-- 4. Access stays server-only (same as schema.sql / funnel-tracking.sql).
alter table public.funnel_events enable row level security;
alter table public.reservations enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;
revoke all on public.reservations from public, anon, authenticated;

notify pgrst, 'reload schema';
