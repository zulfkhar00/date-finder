-- Onboarding step report. Read-only; run in the Supabase SQL editor or via the Management API.
-- Requires 2026-11-10-onboarding-steps.sql for the ob_* rows. One row per step, distinct browser tab sessions,
-- last 7 days, our own probe sessions (00000000-...) dropped. Internal accounts are not separable by session here:
-- founders mark their browser with ?internal=1, which sends probe session ids.
-- Order = the order of the screens: basics > email > email entered > signed in > apps > about > type > photos > consent > early access.
with s as (
  select event, count(distinct session_id) sessions
  from public.funnel_events
  where created_at > now() - interval '7 days' and coalesce(session_id, '') not like '00000000-%'
  group by event
)
select ord, step, coalesce(sessions, 0) as sessions
from (values
  (1, 'page_view', 'page_view'), (2, 'get_started', 'get_started'),
  (3, 'basics screen (reserve_start)', 'reserve_start'), (4, 'email screen (reserve_step_2)', 'reserve_step_2'),
  (5, 'email entered (ob_code_sent)', 'ob_code_sent'), (6, 'signed in (reserve_step_3)', 'reserve_step_3'),
  (7, 'apps', 'ob_apps'), (8, 'about', 'ob_about'), (9, 'type', 'ob_type'), (10, 'photos', 'ob_photos'),
  (11, 'consent', 'ob_consent'), (12, 'finished (onboarding_complete)', 'onboarding_complete'),
  (13, 'early access step', 'ob_pay'), (14, 'checkout_created', 'checkout_created'), (15, 'paid', 'paid')
) v(ord, step, event)
left join s using (event)
order by ord;
