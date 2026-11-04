-- NoSwipe web app (login, onboarding, home, chats, dates, profile) + the admin tools that run it.
-- Idempotent: safe to run again. Run after schema.sql. Do not run against production without the founders' yes.
--
-- Access model
--   * The Next.js server does every write with the service role (SUPABASE_SECRET_KEY). There is no
--     browser Supabase client and no browser write path.
--   * RLS is on for every table. Signed-in users (role `authenticated`) get SELECT on their own rows
--     only. `anon` gets nothing. The service role bypasses RLS and is granted explicitly.
--   * The photo bucket is private: owner (folder = auth.uid()) and service role only.
--   * Chat state is enforced in the database: the AI cannot write into a chat the user has taken over
--     (messages_guard trigger), and a user message needs an active takeover.

-- 1. Tables ---------------------------------------------------------------------------------------

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  birthday date,
  gender text,
  interested_in text[] not null default '{}',
  city text,
  job text,
  height_cm integer,
  interests text[] not null default '{}',
  voice text not null default 'warm',
  onboarding_step integer not null default 0,
  onboarding_done_at timestamptz,
  internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, path)
);
create index if not exists profile_photos_user_idx on public.profile_photos (user_id, position);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  age_min integer,
  age_max integer,
  distance_km integer,
  looking_for text,
  dealbreakers text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version text not null,
  statement text not null,
  accepted_at timestamptz not null default now()
);
create index if not exists consents_user_idx on public.consents (user_id, accepted_at desc);

-- status is what the team set; user_paused is the user's own pause toggle. Effective status is
-- paused when user_paused is true.
create table if not exists public.app_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  status text not null default 'setting_up',
  user_paused boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, app)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  app text not null,
  name text not null,
  age integer,
  photo_path text,
  matched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists matches_user_idx on public.matches (user_id, matched_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  sender text not null,
  body text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists messages_match_idx on public.messages (match_id, sent_at);

create table if not exists public.takeovers (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists takeovers_user_idx on public.takeovers (user_id);
-- At most one active takeover per chat.
create unique index if not exists takeovers_one_active_idx on public.takeovers (match_id) where ended_at is null;

create table if not exists public.dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  match_id uuid references public.matches (id) on delete set null,
  who text not null,
  venue text not null,
  address text,
  starts_at timestamptz not null,
  summary text,
  status text not null default 'booked',
  created_at timestamptz not null default now()
);
create index if not exists dates_user_idx on public.dates (user_id, starts_at);

-- 1b. Columns added after the first cut (idempotent) ---------------------------------------------
alter table public.profiles add column if not exists notify_email boolean not null default true;
alter table public.matches add column if not exists external_id text;
alter table public.matches add column if not exists needs_user boolean not null default false;
alter table public.matches add column if not exists needs_reason text;
alter table public.messages add column if not exists external_id text;
-- User-typed messages wait here until the worker has sent them in the dating app (docs/automation.md).
alter table public.messages add column if not exists delivered_at timestamptz;
create unique index if not exists matches_external_idx on public.matches (user_id, app, external_id) where external_id is not null;
create unique index if not exists messages_external_idx on public.messages (match_id, external_id) where external_id is not null;
create index if not exists messages_outbox_idx on public.messages (created_at) where sender = 'user' and delivered_at is null;

-- 2. Constraints ----------------------------------------------------------------------------------

alter table public.app_accounts drop constraint if exists app_accounts_app_check;
alter table public.app_accounts add constraint app_accounts_app_check check (app in ('tinder', 'hinge', 'bumble'));
alter table public.app_accounts drop constraint if exists app_accounts_status_check;
alter table public.app_accounts add constraint app_accounts_status_check check (status in ('setting_up', 'live', 'paused'));
alter table public.matches drop constraint if exists matches_app_check;
alter table public.matches add constraint matches_app_check check (app in ('tinder', 'hinge', 'bumble'));
alter table public.messages drop constraint if exists messages_sender_check;
alter table public.messages add constraint messages_sender_check check (sender in ('match', 'as_user_ai', 'user', 'system_internal'));
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) between 1 and 4000);
alter table public.dates drop constraint if exists dates_status_check;
alter table public.dates add constraint dates_status_check check (status in ('booked', 'cancelled'));
alter table public.profiles drop constraint if exists profiles_voice_check;
alter table public.profiles add constraint profiles_voice_check check (voice in ('warm', 'playful', 'direct'));
alter table public.profiles drop constraint if exists profiles_sizes_check;
alter table public.profiles add constraint profiles_sizes_check check (
  (first_name is null or char_length(first_name) between 1 and 60)
  and (job is null or char_length(job) <= 120)
  and (height_cm is null or height_cm between 120 and 250)
  and cardinality(interests) <= 6
  and cardinality(interested_in) <= 3
);
alter table public.preferences drop constraint if exists preferences_ranges_check;
alter table public.preferences add constraint preferences_ranges_check check (
  (age_min is null or age_min between 18 and 99)
  and (age_max is null or age_max between 18 and 99)
  and (age_min is null or age_max is null or age_min <= age_max)
  and (distance_km is null or distance_km between 1 and 20000)
  and cardinality(dealbreakers) <= 6
);

-- 3. Chat guard -----------------------------------------------------------------------------------
-- The AI never writes into a chat the user has taken over; a message from the user needs a takeover.
-- The message must also belong to the same user as its match. 'system_internal' rows (took over, handed back,
-- date booked) are notices for the user's own thread only: they are never sent to the match and never
-- reach the worker (the API hides them and the outbox only lists sender = 'user').

create or replace function public.messages_guard() returns trigger
language plpgsql
set search_path = public
as $$
declare
  owner uuid;
  taken boolean;
begin
  select user_id into owner from public.matches where id = new.match_id;
  if owner is null or owner <> new.user_id then
    raise exception 'message user does not own this match' using errcode = '23514';
  end if;
  if new.sender = 'system_internal' then
    return new;
  end if;
  select exists (select 1 from public.takeovers where match_id = new.match_id and ended_at is null) into taken;
  if new.sender = 'as_user_ai' and taken then
    raise exception 'chat is taken over by the user; AI sends are blocked' using errcode = 'P0001';
  end if;
  if new.sender = 'user' and not taken then
    raise exception 'user messages need an active takeover' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_trg on public.messages;
create trigger messages_guard_trg before insert on public.messages for each row execute function public.messages_guard();

revoke all on function public.messages_guard() from public, anon, authenticated;

-- 4. RLS and grants -------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.profile_photos enable row level security;
alter table public.preferences enable row level security;
alter table public.consents enable row level security;
alter table public.app_accounts enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.takeovers enable row level security;
alter table public.dates enable row level security;

revoke all on public.profiles, public.profile_photos, public.preferences, public.consents, public.app_accounts,
  public.matches, public.messages, public.takeovers, public.dates from public, anon, authenticated;
grant select, insert, update, delete on public.profiles, public.profile_photos, public.preferences, public.consents,
  public.app_accounts, public.matches, public.messages, public.takeovers, public.dates to service_role;
-- Users read their own rows. Nothing else: all writes go through the server.
grant select on public.profiles, public.profile_photos, public.preferences, public.consents, public.app_accounts,
  public.matches, public.messages, public.takeovers, public.dates to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'preferences'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_own_select', t);
  end loop;
  foreach t in array array['profile_photos', 'consents', 'app_accounts', 'matches', 'messages', 'takeovers', 'dates'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))', t || '_own_select', t);
  end loop;
end $$;

-- 5. Private photo bucket -------------------------------------------------------------------------
-- Object path: <user id>/<file>. Owner and service role only; the app serves 1-hour signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_photos_owner_select on storage.objects;
create policy profile_photos_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists profile_photos_owner_insert on storage.objects;
create policy profile_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists profile_photos_owner_delete on storage.objects;
create policy profile_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 6. Realtime: the browser listens (with the user's own token, so RLS applies) for new messages,
-- matches, takeovers and dates.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['messages', 'matches', 'takeovers', 'dates', 'app_accounts'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

notify pgrst, 'reload schema';
