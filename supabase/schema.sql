-- Run once in a new Supabase project's SQL editor before starting the app.
-- No browser role receives table access. Only the server's secret key is used.

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 3 and 254),
  city text not null check (char_length(city) between 2 and 120),
  dating_preference text not null check (dating_preference in ('women', 'men', 'all_genders', 'discuss')),
  relationship_goal text not null check (relationship_goal in ('committed', 'meaningful', 'exploring')),
  date_frequency text not null check (date_frequency in ('monthly', 'twice_monthly', 'weekly')),
  age_confirmed_at timestamptz not null,
  terms_accepted_at timestamptz not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'expired')),
  queue_position bigint unique check (queue_position > 0),
  paid_at timestamptz,
  refund_requested_at timestamptz,
  constraint paid_has_position check (status not in ('paid', 'refunded') or queue_position is not null)
);

create index if not exists reservations_status_created_idx on public.reservations (status, created_at);

create table if not exists public.waitlist_counter (
  id boolean primary key default true check (id),
  last_position bigint not null default 0 check (last_position >= 0)
);
insert into public.waitlist_counter (id, last_position) values (true, 0) on conflict (id) do nothing;

alter table public.reservations enable row level security;
alter table public.waitlist_counter enable row level security;

revoke all on public.reservations from public, anon, authenticated;
revoke all on public.waitlist_counter from public, anon, authenticated;
revoke all on public.reservations, public.waitlist_counter from service_role;
grant select, insert, update on public.reservations to service_role;
grant select, update on public.waitlist_counter to service_role;

create or replace function public.finalize_reservation(
  p_reservation_id uuid,
  p_session_id text,
  p_payment_intent_id text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reservation public.reservations%rowtype;
  v_position bigint;
begin
  select * into v_reservation
  from public.reservations
  where id = p_reservation_id
  for update;

  if not found or v_reservation.stripe_checkout_session_id is distinct from p_session_id then
    raise exception 'Reservation or checkout session mismatch';
  end if;

  if v_reservation.status in ('paid', 'refunded') then
    if v_reservation.stripe_payment_intent_id is distinct from p_payment_intent_id then
      raise exception 'Payment intent mismatch';
    end if;
    return v_reservation.queue_position;
  end if;

  if v_reservation.status <> 'pending' then
    raise exception 'Reservation is no longer pending';
  end if;

  update public.waitlist_counter
  set last_position = last_position + 1
  where id = true
  returning last_position into v_position;

  if v_position is null then
    raise exception 'Waitlist counter is missing';
  end if;

  update public.reservations
  set status = 'paid',
      queue_position = v_position,
      stripe_payment_intent_id = p_payment_intent_id,
      paid_at = now()
  where id = p_reservation_id;

  return v_position;
end;
$$;

revoke all on function public.finalize_reservation(uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_reservation(uuid, text, text) to service_role;

notify pgrst, 'reload schema';
