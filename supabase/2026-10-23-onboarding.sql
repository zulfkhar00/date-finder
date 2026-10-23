-- Onboarding answers on each reservation (name, age, apps, who he's looking for, optional
-- Telegram). Run after schema.sql. Idempotent: safe to run again.
-- The app keeps working before this is applied: /api/checkout retries the insert without the
-- column and the admin lead page shows "not stored" instead of failing.

alter table public.reservations add column if not exists onboarding jsonb;

alter table public.reservations drop constraint if exists reservations_onboarding_shape;
alter table public.reservations add constraint reservations_onboarding_shape check (
  onboarding is null
  or (jsonb_typeof(onboarding) = 'object' and octet_length(onboarding::text) <= 2048)
);

-- Same access model as schema.sql: RLS on, browser roles have nothing, service role only.
alter table public.reservations enable row level security;
revoke all on public.reservations from public, anon, authenticated;

notify pgrst, 'reload schema';
