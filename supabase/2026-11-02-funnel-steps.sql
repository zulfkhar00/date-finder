-- Onboarding drop-off: record when a visitor reaches form step 2 and 3. Idempotent.
-- Until applied, /api/event answers 503 (X-Funnel-Error 23514) for these two events only; nothing else is affected.
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check
  check (event in ('page_view', 'get_started', 'reserve_start', 'reserve_step_2', 'reserve_step_3', 'onboarding_complete', 'checkout_created', 'paid', 'checkout_canceled'));

alter table public.funnel_events enable row level security;
revoke all on public.funnel_events from public, anon, authenticated;

notify pgrst, 'reload schema';
