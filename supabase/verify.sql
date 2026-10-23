-- Run in the Supabase SQL editor after schema.sql. This rolls back all test rows.
begin;
set local role service_role;

do $$
declare
  first_id uuid;
  second_id uuid;
  first_position bigint;
  repeated_position bigint;
  second_position bigint;
  first_session text := 'cs_test_verify_' || replace(gen_random_uuid()::text, '-', '');
  second_session text := 'cs_test_verify_' || replace(gen_random_uuid()::text, '-', '');
  first_intent text := 'pi_test_verify_' || replace(gen_random_uuid()::text, '-', '');
  second_intent text := 'pi_test_verify_' || replace(gen_random_uuid()::text, '-', '');
begin
  insert into public.reservations (email, city, dating_preference, relationship_goal, date_frequency, age_confirmed_at, terms_accepted_at, stripe_checkout_session_id)
  values ('verify-one@example.invalid', 'Test City', 'discuss', 'meaningful', 'monthly', now(), now(), first_session)
  returning id into first_id;

  insert into public.reservations (email, city, dating_preference, relationship_goal, date_frequency, age_confirmed_at, terms_accepted_at, stripe_checkout_session_id)
  values ('verify-two@example.invalid', 'Test City', 'discuss', 'meaningful', 'monthly', now(), now(), second_session)
  returning id into second_id;

  first_position := public.finalize_reservation(first_id, first_session, first_intent);
  repeated_position := public.finalize_reservation(first_id, first_session, first_intent);
  second_position := public.finalize_reservation(second_id, second_session, second_intent);

  if first_position <> repeated_position then
    raise exception 'Duplicate payment changed the waitlist position';
  end if;
  if second_position <> first_position + 1 then
    raise exception 'Positions were not assigned sequentially';
  end if;
  raise notice 'Queue verification passed: %, %', first_position, second_position;
end;
$$;

rollback;
