-- Client IANA time zone. Captured silently from the browser during onboarding, editable by an operator on the admin client page,
-- and returned on every run in GET /api/automation/v1/runs so the phone rig can use the client's own quiet hours and daily caps.
-- Idempotent and additive: safe to run again. Null means unknown (the rig then falls back to its own default).
-- The app keeps working before this is applied only if nothing reads the column; apply it before deploying the code that does.

alter table public.profiles add column if not exists timezone text;

alter table public.profiles drop constraint if exists profiles_timezone_check;
alter table public.profiles add constraint profiles_timezone_check check (
  timezone is null or (char_length(timezone) between 1 and 64 and timezone ~ '^(UTC|[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2})$')
);

-- Backfill from the only existing signal: a zone an operator already typed into an account kit. Never overwrites a value.
update public.profiles p
set timezone = k.timezone
from (
  select distinct on (user_id) user_id, timezone
  from public.account_kits
  where timezone ~ '^(UTC|[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2})$'
  order by user_id, updated_at desc
) k
where p.user_id = k.user_id and p.timezone is null;

-- profiles keeps its existing RLS and grants (own rows only, browser roles as in 2026-11-04-app.sql); the check above bounds whatever is written.
