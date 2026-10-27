-- Admin "Videos": the @noswipe.app posting queue, mirrored here so both founders can see what is
-- scheduled, what needs fixes and what went out. Rows are written by an external one-way sync
-- through POST /api/content/sync (bearer CONTENT_SYNC_TOKEN); /admin/videos only reads them and
-- files requests in content_actions, which the same sync applies on its next pass.
-- Idempotent: safe to run again. Only service_role (the server's secret key) can touch any of it.

-- 1. One row per video.
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  -- Opaque key from the sync (a keyed hash). Never shown in the UI.
  external_ref text not null unique,
  title text not null default '',
  caption text not null default '',
  status text not null default 'review',
  scheduled_at timestamptz,
  posted_at timestamptz,
  post_url text,
  submitted_by text,
  source text not null default 'team',
  -- [{ "t": "0:28-0:31", "what": "..." }] when status = 'fix'
  fixes jsonb not null default '[]'::jsonb,
  -- Object path inside the private content-previews bucket.
  preview_path text,
  duration_s numeric(6, 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_posts drop constraint if exists content_posts_status_check;
alter table public.content_posts add constraint content_posts_status_check
  check (status in ('review', 'fix', 'scheduled', 'posted', 'failed', 'skipped'));
alter table public.content_posts drop constraint if exists content_posts_submitted_by_check;
alter table public.content_posts add constraint content_posts_submitted_by_check
  check (submitted_by is null or submitted_by in ('Miko', 'Zulya'));
alter table public.content_posts drop constraint if exists content_posts_source_check;
alter table public.content_posts add constraint content_posts_source_check check (source in ('telegram', 'team'));
alter table public.content_posts drop constraint if exists content_posts_sizes;
alter table public.content_posts add constraint content_posts_sizes check (
  char_length(external_ref) between 8 and 128
  and char_length(title) <= 200
  and char_length(caption) <= 2200
  and (post_url is null or (char_length(post_url) <= 500 and post_url ~ '^https://'))
  and (preview_path is null or char_length(preview_path) <= 200)
  and jsonb_typeof(fixes) = 'array'
);

create index if not exists content_posts_status_idx on public.content_posts (status, scheduled_at);
create index if not exists content_posts_posted_idx on public.content_posts (posted_at desc) where status = 'posted';

-- 2. Requests from /admin/videos. done_at is set by the sync once the queue reflects it.
create table if not exists public.content_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.content_posts (id) on delete cascade,
  action text not null,
  requested_by text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  result text
);

alter table public.content_actions drop constraint if exists content_actions_action_check;
alter table public.content_actions add constraint content_actions_action_check check (action in ('post_anyway', 'dont_post'));
alter table public.content_actions drop constraint if exists content_actions_sizes;
alter table public.content_actions add constraint content_actions_sizes check (
  char_length(requested_by) between 3 and 254 and (result is null or char_length(result) <= 300)
);

-- At most one open request per video, so a double click or both founders at once is one request.
create unique index if not exists content_actions_one_open_idx on public.content_actions (post_id) where done_at is null;
create index if not exists content_actions_open_idx on public.content_actions (created_at) where done_at is null;

alter table public.content_posts enable row level security;
alter table public.content_actions enable row level security;

revoke all on public.content_posts, public.content_actions from public, anon, authenticated;
revoke all on public.content_posts, public.content_actions from service_role;
grant select, insert, update on public.content_posts to service_role;
grant select, insert, update on public.content_actions to service_role;

-- 3. Private bucket for small previews (540p mp4 or a jpg poster). No storage policies, so
-- anon/authenticated get nothing; the admin page hands out 10-minute signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-previews', 'content-previews', false, 26214400, array['video/mp4', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
