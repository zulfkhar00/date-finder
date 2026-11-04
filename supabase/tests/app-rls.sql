-- RLS + chat-guard checks for supabase/2026-11-04-app.sql. Everything happens inside one DO block
-- that ends by raising 'APP_RLS_OK', so nothing is ever committed. Run it in the SQL editor (or with
-- scripts/run-app-rls-test.mjs). Success = the error message is exactly APP_RLS_OK.
do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ma uuid := gen_random_uuid();
  mb uuid := gen_random_uuid();
  n int;
  ok boolean;
begin
  insert into auth.users (id, instance_id, aud, role, email) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@example.test'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@example.test');
  insert into public.profiles (user_id, first_name) values (a, 'A'), (b, 'B');
  insert into public.matches (id, user_id, app, name) values (ma, a, 'hinge', 'Maya'), (mb, b, 'tinder', 'Zoe');
  insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'match', 'hi'), (mb, b, 'match', 'hey');
  insert into public.dates (user_id, who, venue, starts_at) values (a, 'Maya', 'Taco place', now()), (b, 'Zoe', 'Cafe', now());
  insert into public.consents (user_id, version, statement) values (a, 'v1', 'x'), (b, 'v1', 'x');

  -- Takeover state, as the service role (we are postgres here, which bypasses RLS).
  insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'as_user_ai', 'oh yesss that would be cool');
  begin
    insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'user', 'nope');
    raise exception 'user message without takeover was accepted';
  exception when sqlstate 'P0001' then null; end;
  insert into public.takeovers (match_id, user_id) values (ma, a);
  insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'system_internal', '{"kind":"took_over"}');
  begin
    insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'as_user_ai', 'blocked');
    raise exception 'AI send during takeover was accepted';
  exception when sqlstate 'P0001' then null; end;
  insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'user', 'i got this');
  begin
    insert into public.messages (match_id, user_id, sender, body) values (mb, a, 'match', 'cross-user');
    raise exception 'message for another user''s match was accepted';
  exception when check_violation then null; end;
  update public.takeovers set ended_at = now() where match_id = ma;
  insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'as_user_ai', 'back to AI');

  -- Act as user A.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.profiles;           if n <> 1 then raise exception 'profiles leak: %', n; end if;
  select count(*) into n from public.matches;            if n <> 1 then raise exception 'matches leak: %', n; end if;
  select count(*) into n from public.messages;           if n <> 5 then raise exception 'messages leak or miss: %', n; end if;
  select count(*) into n from public.dates;              if n <> 1 then raise exception 'dates leak: %', n; end if;
  select count(*) into n from public.consents;           if n <> 1 then raise exception 'consents leak: %', n; end if;
  begin
    insert into public.messages (match_id, user_id, sender, body) values (ma, a, 'as_user_ai', 'browser write');
    raise exception 'authenticated insert was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set first_name = 'hack' where user_id = a;
    raise exception 'authenticated update was allowed';
  exception when insufficient_privilege then null; end;

  -- Anonymous gets nothing at all.
  reset role;
  set local role anon;
  begin
    perform 1 from public.matches limit 1;
    raise exception 'anon could read matches';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.profiles limit 1;
    raise exception 'anon could read profiles';
  exception when insufficient_privilege then null; end;
  reset role;

  raise exception 'APP_RLS_OK';
end $$;
