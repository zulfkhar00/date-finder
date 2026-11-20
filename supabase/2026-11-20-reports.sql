-- Takedown process: public report form (/report), the admin queue (/admin/reports), appeals and the audit log.
-- Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql and 2026-11-20-photo-flags.sql.
-- Do not run against production without the founders' yes.
--
-- The app keeps working before this is applied: /report answers "email us" instead of storing anything, /admin/reports
-- shows a setup notice, and nobody sees an appeal notice (the profiles columns are read tolerantly).
--
-- Access model: reports and reports_events are SERVER ONLY (RLS on, every browser role revoked, service role only). The three
-- new profiles columns are the only thing a signed-in user can read: the hold state and the reference of the report that
-- caused it, so the app can show the appeal notice. Users cannot write them (profiles has no write grant for browsers).
-- The report-uploads bucket is private with NO policy for anon or authenticated: only the service role can read or write it.
-- What is stored about a reporter: the optional email they typed and a keyed hash of their IP address (rate limiting only).
-- Report text and screenshots are never logged.

-- 1. Reports. One row per submission; reports about the same profile share group_key.
--   status: new -> acknowledged -> investigating -> actioned | dismissed; actioned -> appealed -> actioned (upheld) | dismissed (overturned)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  ref text not null,
  status text not null default 'new',
  category text not null,
  urgent boolean not null default false,
  in_danger boolean not null default false,
  subject_kind text not null,
  dating_app text,
  profile_ref text,
  group_key text,
  description text not null,
  reporter_email text,
  attachment_path text,
  ip_hash text,
  matched_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ack_at timestamptz,
  ack_by text,
  resolved_at timestamptz,
  decided_by text,
  pause_snapshot jsonb,
  ncmec_filed_at timestamptz,
  ncmec_report_id text,
  ncmec_filed_by text,
  appeal_text text,
  appealed_at timestamptz,
  appeal_outcome text,
  appeal_decided_by text,
  appeal_decided_at timestamptz,
  ack_breach_alerted_at timestamptz,
  resolve_breach_alerted_at timestamptz
);
-- Columns added after the first cut would go here as `alter table ... add column if not exists`.

create unique index if not exists reports_ref_idx on public.reports (ref);
create index if not exists reports_status_idx on public.reports (status, created_at);
create index if not exists reports_group_idx on public.reports (group_key) where group_key is not null;
create index if not exists reports_ip_idx on public.reports (ip_hash, created_at) where ip_hash is not null;
create index if not exists reports_user_idx on public.reports (matched_user_id) where matched_user_id is not null;

alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check check (status in ('new', 'acknowledged', 'investigating', 'actioned', 'dismissed', 'appealed'));
alter table public.reports drop constraint if exists reports_category_check;
alter table public.reports add constraint reports_category_check check (category in (
  'minor_safety', 'trafficking', 'non_consensual_images', 'threats', 'harassment', 'scam_fraud', 'impersonation', 'other'
));
alter table public.reports drop constraint if exists reports_subject_kind_check;
alter table public.reports add constraint reports_subject_kind_check check (subject_kind in ('profile', 'message', 'photo', 'other'));
alter table public.reports drop constraint if exists reports_dating_app_check;
alter table public.reports add constraint reports_dating_app_check check (dating_app is null or dating_app in ('tinder', 'hinge', 'bumble', 'badoo', 'other'));
alter table public.reports drop constraint if exists reports_text_check;
alter table public.reports add constraint reports_text_check check (
  char_length(description) between 1 and 4000
  and (profile_ref is null or char_length(profile_ref) <= 300)
  and (reporter_email is null or char_length(reporter_email) <= 254)
  and (appeal_text is null or char_length(appeal_text) <= 2000)
  and char_length(ref) between 6 and 24
);
alter table public.reports drop constraint if exists reports_appeal_outcome_check;
alter table public.reports add constraint reports_appeal_outcome_check check (appeal_outcome is null or appeal_outcome in ('upheld', 'overturned'));

-- 2. Audit log: every action by an admin (and the system or the user) on a report. Append only by convention; nothing updates it.
create table if not exists public.reports_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null,
  note text,
  detail jsonb
);
create index if not exists reports_events_report_idx on public.reports_events (report_id, at);

alter table public.reports_events drop constraint if exists reports_events_check;
alter table public.reports_events add constraint reports_events_check check (
  char_length(actor) between 1 and 254
  and (note is null or char_length(note) <= 2000)
  and (detail is null or (jsonb_typeof(detail) = 'object' and pg_column_size(detail) <= 4096))
);

-- 3. What a signed-in user may see about a hold placed after a report (read through their own-rows policy).
--   report_hold: paused (no activity, can appeal) | closed (soft close: signed in, nothing runs, can appeal)
alter table public.profiles add column if not exists report_hold text;
alter table public.profiles add column if not exists report_hold_report_id uuid references public.reports (id) on delete set null;
alter table public.profiles add column if not exists report_hold_at timestamptz;
alter table public.profiles drop constraint if exists profiles_report_hold_check;
alter table public.profiles add constraint profiles_report_hold_check check (report_hold is null or report_hold in ('paused', 'closed'));

-- 4. Server only.
alter table public.reports enable row level security;
alter table public.reports_events enable row level security;
revoke all on public.reports from public, anon, authenticated;
revoke all on public.reports_events from public, anon, authenticated;
grant select, insert, update, delete on public.reports to service_role;
grant select, insert on public.reports_events to service_role;

-- 5. Private bucket for the optional screenshot. 4 MB and three image types, enforced by Storage as well as by the app.
-- Object path: <report ref>/<random>.<ext>. No policy for browser roles, so only the service role can touch it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-uploads', 'report-uploads', false, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
