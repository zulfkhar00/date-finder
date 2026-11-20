-- Photo flagging for human review: the starter pack's photo call also reports per-photo safety flags
-- (explicit_or_sexual, possible_minor, not_a_real_person_or_not_the_user, violence_or_weapons). A flagged photo is held
-- out of the pack and shown to an admin, who approves it (false positive) or removes it (soft delete).
-- Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql. Do not run against production without the founders' yes.
--
-- The app keeps working before this is applied: nothing is flagged, nothing is soft-deleted, the admin Flagged filter is empty.
--
-- Access model: photo_flags is SERVER ONLY (RLS on, every browser role revoked, service role only). A user cannot read
-- why a photo was flagged; the app tells them one neutral sentence. profile_photos gets one new column, deleted_at, and the
-- user's own-rows SELECT policy now hides soft-deleted rows, so a removed photo disappears from their app by itself.
-- The file stays in the private bucket until a person purges it. No photo, path or prompt is stored in photo_flags.

-- 1. Soft delete.
alter table public.profile_photos add column if not exists deleted_at timestamptz;
create index if not exists profile_photos_live_idx on public.profile_photos (user_id, position) where deleted_at is null;

drop policy if exists profile_photos_own_select on public.profile_photos;
create policy profile_photos_own_select on public.profile_photos for select to authenticated
  using (user_id = (select auth.uid()) and deleted_at is null);

-- 2. The verdict per photo. One row per photo; cascades with the photo and with the account.
--   clear    : checked, nothing flagged
--   flagged  : waiting for a person; held out of the pack
--   approved : a person said it is fine (a later model flag no longer applies)
--   removed  : a person removed it (profile_photos.deleted_at is set)
create table if not exists public.photo_flags (
  photo_id uuid primary key references public.profile_photos (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  flags text[] not null default '{}',
  status text not null default 'clear',
  checked_at timestamptz not null default now(),
  flagged_at timestamptz,
  reviewed_at timestamptz
);
create index if not exists photo_flags_user_idx on public.photo_flags (user_id);
create index if not exists photo_flags_flagged_idx on public.photo_flags (user_id) where status = 'flagged';

alter table public.photo_flags drop constraint if exists photo_flags_status_check;
alter table public.photo_flags add constraint photo_flags_status_check check (status in ('clear', 'flagged', 'approved', 'removed'));
alter table public.photo_flags drop constraint if exists photo_flags_flags_check;
alter table public.photo_flags add constraint photo_flags_flags_check check (
  flags <@ array['explicit_or_sexual', 'possible_minor', 'not_a_real_person_or_not_the_user', 'violence_or_weapons']::text[]
);

-- 3. Server only.
alter table public.photo_flags enable row level security;
revoke all on public.photo_flags from public, anon, authenticated;
grant select, insert, update, delete on public.photo_flags to service_role;

notify pgrst, 'reload schema';
