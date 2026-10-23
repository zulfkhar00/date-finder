-- Confirmation email guard. Run after schema.sql. Idempotent: safe to run again.
-- The Stripe webhook claims this column with a conditional update before it sends the
-- "you're #N in line" email, so each paid reservation gets it at most once. Until this is
-- applied the webhook still sends, relying on the paid funnel event dedupe instead.

alter table public.reservations add column if not exists confirmation_email_sent_at timestamptz;

-- RLS and grants are unchanged from schema.sql: browser roles have no access, service_role keeps
-- select/insert/update. Re-asserted here so running this file alone can't widen access.
alter table public.reservations enable row level security;
revoke all on public.reservations from public, anon, authenticated;

notify pgrst, 'reload schema';
