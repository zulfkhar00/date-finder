-- prod funnel_events_event_check before 2026-11-10-onboarding-steps.sql (2026-11-11T08:08:58Z)
alter table public.funnel_events drop constraint if exists funnel_events_event_check;
alter table public.funnel_events add constraint funnel_events_event_check CHECK ((event = ANY (ARRAY['checkout_canceled'::text, 'checkout_created'::text, 'get_started'::text, 'onboarding_complete'::text, 'page_view'::text, 'paid'::text, 'reserve_start'::text, 'reserve_step_2'::text, 'reserve_step_3'::text, 'try_cta_click'::text, 'try_result'::text, 'try_start'::text])));
