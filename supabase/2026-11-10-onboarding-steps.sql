-- Per-step onboarding funnel events. Idempotent: safe to run again, in any order relative to the other
-- funnel_events migrations (it keeps every event name already allowed in prod and adds the new ones).
-- New browser events (one per screen shown, once per tab session):
--   ob_code_sent (email entered), ob_apps, ob_about, ob_type, ob_photos, ob_consent, ob_pay
-- Until this is applied /api/event answers 503 (X-Funnel-Error 23514) for these events only; the page is unaffected.
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in (
    'page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete',
    'checkout_created', 'paid', 'checkout_canceled',
    'try_cta_click', 'try_result', 'try_start',
    'ob_code_sent', 'ob_apps', 'ob_about', 'ob_type', 'ob_photos', 'ob_consent', 'ob_pay'
  ));

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;

notify pgrst, 'reload schema';
