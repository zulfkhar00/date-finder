-- In-app "finish setting up" card events. Idempotent: safe to run again, in any order relative to the other
-- funnel_events migrations (it keeps every event name already allowed in prod and adds the new ones).
-- New browser events: resume_card_view (card shown, once per tab session), resume_card_click (Activate tapped).
-- Until this is applied /api/event answers 503 (X-Funnel-Error 23514) for these two events only; the page is unaffected.
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in (
    'page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete',
    'checkout_created', 'paid', 'checkout_canceled',
    'try_cta_click', 'try_result', 'try_start',
    'ob_code_sent', 'ob_apps', 'ob_about', 'ob_type', 'ob_photos', 'ob_consent', 'ob_pay',
    'resume_card_view', 'resume_card_click'
  ));

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;

notify pgrst, 'reload schema';
