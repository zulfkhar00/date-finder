-- Match profile pages and read state. Idempotent and additive: safe to run again. Run after 2026-11-04-app.sql.
-- Do not run against production without the founders' yes.
--
--   * matches.profile: what the app knows about the match (bio, prompts, passions, photo paths, distance) as jsonb. Null for matches the
--     rig created without one; the app then shows no profile page. Written only by the server (service role).
--   * matches.last_read_at: when the user last opened the chat. Null means read state is not tracked for this match (no unread badge).
--     An unread message is one from the match sent after this time.
-- Both columns sit on a table the owner can already read (RLS own-select); browser roles still cannot write it.

alter table public.matches add column if not exists profile jsonb;
alter table public.matches add column if not exists last_read_at timestamptz;

notify pgrst, 'reload schema';
