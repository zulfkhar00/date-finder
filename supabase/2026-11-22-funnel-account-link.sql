-- Funnel account link + confirmed signups. Idempotent and additive: nothing is dropped or rewritten,
-- existing rows keep NULL in the new columns. Run after 2026-11-21-reply-helper.sql (the event list
-- below is its list plus signup_confirmed; it must keep reply_helper_used / reply_copied or applying this would drop them). The app keeps working before this is applied: inserts fall back
-- to the older row shapes, the funnel keeps its old (session-only) exclusions, and the digest shows
-- "Confirmed signups: n/a" instead of a made-up zero.
--
-- Why: funnel_events only carried a random per-tab session id, so a signed-in founder who left before
-- checkout looked like a real visitor (only a checkout could tie a session to an excluded email).
-- The server now stamps events from a SIGNED-IN browser with the account's id and an internal flag, and
-- records one signup_confirmed event per account at its first email confirmation.
--
-- No emails here. user_id is the auth user id; account_internal is true when the account's email is a
-- founder / test address (lib/internal-traffic) at the time of the event, false for any other signed-in
-- account, NULL for guests and for every row written before this migration (unclassifiable, never guessed).
-- profiles.internal is read at report time, so flagging an account later still excludes its tagged sessions.

alter table public.funnel_events add column if not exists user_id uuid;
alter table public.funnel_events add column if not exists account_internal boolean;

create index if not exists funnel_events_user_idx on public.funnel_events (user_id) where user_id is not null;
create index if not exists funnel_events_signup_idx on public.funnel_events (created_at) where event = 'signup_confirmed';

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
    'reply_helper_used', 'reply_copied',
    'signup_confirmed'
  ));
