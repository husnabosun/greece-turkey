-- Security hardening (stress test findings A1–A6, C7):
--  * roles come only from app_metadata (service role), never from client user_metadata
--  * nobody can change their own role
--  * offers: immutable terms, legal status transitions per party, accept only by the counterparty
--  * counter offers and delivery steps go through SECURITY DEFINER RPCs that validate the acting party
--  * deliveries: farmers cannot write, processors cannot change price/tons/parties
--  * lots: farmers cannot touch reserved/sold lots, identity unlock or lab columns
--  * processors read a farmer profile only after the identity is unlocked (accepted deal)
-- Direct client writes run as role "authenticated"; SECURITY DEFINER functions owned by postgres
-- run as "postgres", so the guards below only apply to direct client writes.

-- ---------------------------------------------------------------------------
-- 1. Signup: role from app_metadata only
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role public.user_role := 'farmer';
  chosen_locale public.locale_code;
  v_company text;
begin
  -- raw_app_meta_data can only be written with the service role (our /api/auth/register
  -- after the invite-code check). user_metadata is client controlled and is ignored for role.
  if (new.raw_app_meta_data ->> 'role') = 'processor' then
    chosen_role := 'processor';
  end if;

  begin
    chosen_locale := coalesce((new.raw_user_meta_data ->> 'locale')::public.locale_code, 'el');
  exception when others then
    chosen_locale := 'el';
  end;

  v_company := nullif(trim(new.raw_user_meta_data ->> 'company_name'), '');
  if chosen_role = 'processor' then
    v_company := coalesce(v_company, nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1));
  else
    v_company := null;
  end if;

  insert into public.profiles (id, role, display_name, company_name, locale, country)
  values (
    new.id,
    chosen_role,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 80),
    left(v_company, 120),
    chosen_locale,
    case when (new.raw_user_meta_data ->> 'country') in ('GR', 'TR')
         then (new.raw_user_meta_data ->> 'country')::public.country_code end
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Profiles: no self role change; tighter counterparty reads
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if new.role is distinct from old.role then
      raise exception 'role_change_forbidden' using errcode = '42501';
    end if;
    if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.role = 'farmer' then
      new.company_name := old.company_name;
    end if;
    new.display_name := left(new.display_name, 80);
    new.company_name := left(new.company_name, 120);
    new.place := left(new.place, 120);
    new.phone := left(new.phone, 40);
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_update on public.profiles;
create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- A processor must not learn who the farmer is just by placing a bid; names unlock on acceptance
-- (profiles_select_unlocked_counterparty covers identity_unlocked_for + deliveries).
drop policy if exists profiles_select_offer_counterparty on public.profiles;
create policy profiles_select_offer_counterparty on public.profiles
  for select to authenticated
  using (
    exists (
      select 1 from public.offers o
      where o.processor_id = profiles.id and o.farmer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Bounds (UI validates the same ranges)
-- ---------------------------------------------------------------------------
alter table public.lots drop constraint if exists lots_tons_range_chk;
alter table public.lots add constraint lots_tons_range_chk check (tons >= 0.1 and tons <= 500);
alter table public.lots drop constraint if exists lots_price_range_chk;
alter table public.lots add constraint lots_price_range_chk check (price_per_kg is null or (price_per_kg >= 0.05 and price_per_kg <= 20));

alter table public.offers drop constraint if exists offers_tons_range_chk;
alter table public.offers add constraint offers_tons_range_chk check (tons >= 0.1 and tons <= 500);
alter table public.offers drop constraint if exists offers_price_range_chk;
alter table public.offers add constraint offers_price_range_chk check (price_per_kg >= 0.05 and price_per_kg <= 20);
alter table public.offers drop constraint if exists offers_message_len_chk;
alter table public.offers add constraint offers_message_len_chk check (message is null or length(message) <= 500);
alter table public.offers drop constraint if exists offers_delivery_days_chk;
alter table public.offers add constraint offers_delivery_days_chk check (delivery_in_days is null or delivery_in_days <= 60);

alter table public.buy_requests drop constraint if exists buy_requests_tons_range_chk;
alter table public.buy_requests add constraint buy_requests_tons_range_chk check (tons >= 0.1 and tons <= 2000);
alter table public.buy_requests drop constraint if exists buy_requests_text_len_chk;
alter table public.buy_requests add constraint buy_requests_text_len_chk
  check (length(variety) <= 40 and (region is null or length(region) <= 60) and (window_label is null or length(window_label) <= 60));

alter table public.deliveries drop constraint if exists deliveries_actual_kg_range_chk;
alter table public.deliveries add constraint deliveries_actual_kg_range_chk
  check (actual_kg is null or (actual_kg >= tons * 300 and actual_kg <= tons * 2000));

alter table public.fields drop constraint if exists fields_tree_count_max_chk;
alter table public.fields add constraint fields_tree_count_max_chk check (tree_count is null or tree_count <= 100000);
alter table public.fields drop constraint if exists fields_name_len_chk;
alter table public.fields add constraint fields_name_len_chk check (length(trim(name)) between 1 and 80);

alter table public.tasks drop constraint if exists tasks_title_len_chk;
alter table public.tasks add constraint tasks_title_len_chk check (length(title) between 1 and 200);

-- Amount the farmer is paid: weighed kg when known, otherwise the agreed tons. One source of truth for both sides.
alter table public.deliveries drop column if exists amount_eur;
alter table public.deliveries add column amount_eur numeric(14, 2)
  generated always as (round(coalesce(actual_kg, tons * 1000) * price_per_kg, 2)) stored;

-- One live bid per processor and lot; an offer can be countered once.
create unique index if not exists offers_one_pending_processor_bid
  on public.offers (lot_id, processor_id)
  where status = 'pending' and initiated_by = 'processor';
create unique index if not exists offers_single_counter
  on public.offers (counter_of)
  where counter_of is not null;
create unique index if not exists offers_one_pending_farmer_offer_per_lot
  on public.offers (lot_id, processor_id)
  where status = 'pending' and initiated_by = 'farmer';

-- ---------------------------------------------------------------------------
-- 4. Lots guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_lot_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'listed') then
      raise exception 'invalid_lot_status' using errcode = '42501';
    end if;
    new.identity_unlocked_for := '{}';
    new.lab_result := null;
    new.lab_acidity := null;
    new.lab_tested_at := null;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status in ('reserved', 'sold') then
      raise exception 'lot_locked' using errcode = '42501';
    end if;
    return old;
  end if;

  -- field deleted (FK on delete set null): always allowed
  if new.field_id is null and old.field_id is not null
     and (to_jsonb(new) - 'field_id' - 'updated_at') = (to_jsonb(old) - 'field_id' - 'updated_at') then
    return new;
  end if;

  if new.farmer_id is distinct from old.farmer_id
     or new.identity_unlocked_for is distinct from old.identity_unlocked_for
     or new.lab_result is distinct from old.lab_result
     or new.lab_acidity is distinct from old.lab_acidity
     or new.lab_tested_at is distinct from old.lab_tested_at
     or new.created_at is distinct from old.created_at then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if old.status in ('reserved', 'sold') then
    raise exception 'lot_locked' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('listed', 'withdrawn'))
      or (old.status = 'listed' and new.status = 'withdrawn')
      or (old.status = 'withdrawn' and new.status = 'listed')
    ) then
      raise exception 'invalid_lot_status' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists lots_guard_write on public.lots;
create trigger lots_guard_write
  before insert or update or delete on public.lots
  for each row execute function public.guard_lot_write();

-- ---------------------------------------------------------------------------
-- 5. Offers guard
-- ---------------------------------------------------------------------------
create or replace function public.guard_offer_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_lot record;
  v_br record;
  v_uid uuid := auth.uid();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pending' then
      raise exception 'invalid_offer_status' using errcode = '42501';
    end if;
    select id, farmer_id, status, tons into v_lot from public.lots where id = new.lot_id;
    if not found then
      raise exception 'lot_not_found';
    end if;
    if new.tons > v_lot.tons then
      raise exception 'tons_exceed_lot' using errcode = '23514';
    end if;

    if new.initiated_by = 'processor' then
      if v_uid is distinct from new.processor_id or v_lot.status <> 'listed' then
        raise exception 'forbidden' using errcode = '42501';
      end if;
      if new.counter_of is not null then
        raise exception 'use_counter_offer_rpc' using errcode = '42501';
      end if;
    else
      if v_uid is distinct from new.farmer_id or v_lot.farmer_id is distinct from v_uid then
        raise exception 'forbidden' using errcode = '42501';
      end if;
      if new.counter_of is not null then
        raise exception 'use_counter_offer_rpc' using errcode = '42501';
      end if;
      -- A farmer can only open an offer towards a mill's active buy request.
      if new.buy_request_id is null then
        raise exception 'forbidden' using errcode = '42501';
      end if;
      select id, processor_id, active, shared_with_farmers into v_br
      from public.buy_requests where id = new.buy_request_id;
      if not found or not v_br.active or not v_br.shared_with_farmers
         or v_br.processor_id is distinct from new.processor_id then
        raise exception 'request_closed' using errcode = '42501';
      end if;
      if v_lot.status not in ('draft', 'listed') then
        raise exception 'lot_not_listed';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: terms are immutable for clients
  if new.lot_id is distinct from old.lot_id
     or new.farmer_id is distinct from old.farmer_id
     or new.processor_id is distinct from old.processor_id
     or new.initiated_by is distinct from old.initiated_by
     or new.tons is distinct from old.tons
     or new.price_per_kg is distinct from old.price_per_kg
     or new.counter_of is distinct from old.counter_of
     or new.buy_request_id is distinct from old.buy_request_id
     or new.delivery_in_days is distinct from old.delivery_in_days
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'offer_terms_locked' using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'accepted' then
    raise exception 'use_accept_offer_rpc' using errcode = '42501';
  end if;
  if new.status = 'countered' then
    raise exception 'use_counter_offer_rpc' using errcode = '42501';
  end if;
  if old.status <> 'pending' then
    raise exception 'offer_not_pending';
  end if;

  if new.status = 'withdrawn' then
    -- the author withdraws; the farmer may also withdraw bids when pulling his own lot
    if not (
      (old.initiated_by = 'processor' and v_uid = old.processor_id)
      or (old.initiated_by = 'farmer' and v_uid = old.farmer_id)
      or (v_uid = old.farmer_id)
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  elsif new.status = 'rejected' then
    -- only the receiving side rejects
    if not (
      (old.initiated_by = 'processor' and v_uid = old.farmer_id)
      or (old.initiated_by = 'farmer' and v_uid = old.processor_id)
    ) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'invalid_offer_status' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists offers_guard_write on public.offers;
create trigger offers_guard_write
  before insert or update on public.offers
  for each row execute function public.guard_offer_write();

-- ---------------------------------------------------------------------------
-- 6. Deliveries guard: only processor, only schedule/notes; steps via RPC
-- ---------------------------------------------------------------------------
drop policy if exists deliveries_farmer_update_notes on public.deliveries;
drop policy if exists deliveries_participants_insert_on_accept on public.deliveries;

create or replace function public.guard_delivery_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'use_accept_offer_rpc' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     or new.offer_id is distinct from old.offer_id
     or new.lot_id is distinct from old.lot_id
     or new.farmer_id is distinct from old.farmer_id
     or new.processor_id is distinct from old.processor_id
     or new.tons is distinct from old.tons
     or new.price_per_kg is distinct from old.price_per_kg
     or new.actual_kg is distinct from old.actual_kg
     or new.lab_result is distinct from old.lab_result
     or new.weighed_at is distinct from old.weighed_at
     or new.lab_checked_at is distinct from old.lab_checked_at
     or new.paid_at is distinct from old.paid_at
     or new.banned_free is distinct from old.banned_free
     or new.created_at is distinct from old.created_at then
    raise exception 'use_advance_delivery_rpc' using errcode = '42501';
  end if;
  if new.scheduled_for is distinct from old.scheduled_for and old.status <> 'scheduled' then
    raise exception 'delivery_locked' using errcode = '42501';
  end if;
  if new.quality_score_snapshot is distinct from old.quality_score_snapshot and old.quality_score_snapshot is not null then
    raise exception 'delivery_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists deliveries_guard_write on public.deliveries;
create trigger deliveries_guard_write
  before insert or update on public.deliveries
  for each row execute function public.guard_delivery_write();

-- ---------------------------------------------------------------------------
-- 7. accept_offer: only the receiving party; draft lots allowed for buy-request offers
-- ---------------------------------------------------------------------------
create or replace function public.accept_offer(
  p_offer_id uuid,
  p_scheduled_for date default null,
  p_delivery_in_days integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_lot public.lots%rowtype;
  v_br public.buy_requests%rowtype;
  v_delivery_id uuid;
  v_days integer;
  v_scheduled date;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer_not_found';
  end if;

  -- The side that made the offer can never accept it.
  if not (
    (v_offer.initiated_by = 'processor' and v_uid = v_offer.farmer_id)
    or (v_offer.initiated_by = 'farmer' and v_uid = v_offer.processor_id)
  ) then
    raise exception 'forbidden';
  end if;

  if v_offer.status = 'accepted' then
    select id into v_delivery_id from public.deliveries where offer_id = p_offer_id;
    return v_delivery_id;
  end if;
  if v_offer.status is distinct from 'pending' then
    raise exception 'offer_not_pending';
  end if;

  select * into v_lot from public.lots where id = v_offer.lot_id for update;
  if not found then
    raise exception 'offer_not_found';
  end if;
  if not (
    v_lot.status = 'listed'
    or (v_lot.status = 'draft' and v_offer.buy_request_id is not null)
  ) then
    raise exception 'lot_not_listed';
  end if;
  if v_offer.tons > v_lot.tons then
    raise exception 'tons_exceed_lot';
  end if;

  if v_offer.buy_request_id is not null then
    select * into v_br from public.buy_requests where id = v_offer.buy_request_id for update;
    if not found or not v_br.active then
      raise exception 'request_closed';
    end if;
  end if;

  v_days := least(60, greatest(0, coalesce(p_delivery_in_days, v_offer.delivery_in_days, 2)));
  v_scheduled := coalesce(p_scheduled_for, (timezone('utc', now()))::date + v_days);
  if v_scheduled < (timezone('utc', now()))::date or v_scheduled > (timezone('utc', now()))::date + 90 then
    raise exception 'invalid_date';
  end if;

  update public.offers
  set status = 'rejected', updated_at = now()
  where lot_id = v_offer.lot_id
    and id is distinct from p_offer_id
    and status in ('pending', 'countered');

  update public.offers
  set status = 'accepted', delivery_in_days = v_days, updated_at = now()
  where id = p_offer_id;
  -- on_offer_accepted reserves the lot + creates the delivery; bump_buy_request_on_accept fills the request

  select id into v_delivery_id from public.deliveries where offer_id = p_offer_id;
  if v_delivery_id is null then
    insert into public.deliveries (offer_id, lot_id, farmer_id, processor_id, tons, price_per_kg, status, scheduled_for)
    values (v_offer.id, v_offer.lot_id, v_offer.farmer_id, v_offer.processor_id, v_offer.tons, v_offer.price_per_kg, 'scheduled', v_scheduled)
    returning id into v_delivery_id;
  else
    update public.deliveries set scheduled_for = v_scheduled where id = v_delivery_id;
  end if;

  if v_offer.buy_request_id is not null then
    update public.buy_requests
    set active = case when filled_tons >= tons then false else active end
    where id = v_offer.buy_request_id;
  end if;

  return v_delivery_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. counter_offer: atomic (no double counters), only the receiving party
-- ---------------------------------------------------------------------------
create or replace function public.counter_offer(p_offer_id uuid, p_price_per_kg numeric)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_offer public.offers%rowtype;
  v_lot_status public.lot_status;
  v_new_id uuid;
  v_uid uuid := auth.uid();
  v_side public.user_role;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;
  if p_price_per_kg is null or p_price_per_kg < 0.05 or p_price_per_kg > 20 then
    raise exception 'invalid_price';
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then
    raise exception 'offer_not_found';
  end if;

  if v_offer.initiated_by = 'processor' and v_uid = v_offer.farmer_id then
    v_side := 'farmer';
  elsif v_offer.initiated_by = 'farmer' and v_uid = v_offer.processor_id then
    v_side := 'processor';
  else
    raise exception 'forbidden';
  end if;

  if v_offer.status is distinct from 'pending' then
    raise exception 'offer_not_pending';
  end if;

  select status into v_lot_status from public.lots where id = v_offer.lot_id;
  if not (v_lot_status = 'listed' or (v_lot_status = 'draft' and v_offer.buy_request_id is not null)) then
    raise exception 'lot_not_listed';
  end if;

  update public.offers set status = 'countered', updated_at = now() where id = p_offer_id;

  insert into public.offers (
    lot_id, farmer_id, processor_id, initiated_by, status, tons, price_per_kg,
    delivery_in_days, counter_of, buy_request_id
  ) values (
    v_offer.lot_id, v_offer.farmer_id, v_offer.processor_id, v_side, 'pending', v_offer.tons,
    round(p_price_per_kg, 2), v_offer.delivery_in_days, v_offer.id, v_offer.buy_request_id
  )
  returning id into v_new_id;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. advance_delivery / cancel_delivery: processor only, legal steps only
-- ---------------------------------------------------------------------------
create or replace function public.advance_delivery(
  p_delivery_id uuid,
  p_next public.delivery_status,
  p_actual_kg numeric default null,
  p_lab_result public.lab_result default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.deliveries%rowtype;
  v_score integer;
begin
  select * into v_d from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if auth.uid() is distinct from v_d.processor_id then
    raise exception 'forbidden';
  end if;

  if v_d.status = p_next then
    return v_d; -- idempotent (double click)
  end if;

  if v_d.status = 'scheduled' and p_next = 'weighed' then
    if p_actual_kg is null or p_actual_kg < v_d.tons * 300 or p_actual_kg > v_d.tons * 2000 then
      raise exception 'invalid_weight';
    end if;
    select quality_score into v_score from public.lots where id = v_d.lot_id;
    update public.deliveries
    set status = 'weighed', actual_kg = round(p_actual_kg, 2),
        quality_score_snapshot = coalesce(quality_score_snapshot, v_score)
    where id = p_delivery_id
    returning * into v_d;
  elsif v_d.status = 'weighed' and p_next = 'lab_checked' then
    if p_lab_result is null then
      raise exception 'lab_result_required';
    end if;
    update public.deliveries
    set status = 'lab_checked', lab_result = p_lab_result
    where id = p_delivery_id
    returning * into v_d;
    update public.lots
    set lab_result = p_lab_result, lab_tested_at = (timezone('utc', now()))::date
    where id = v_d.lot_id;
  elsif v_d.status = 'lab_checked' and p_next = 'paid' then
    if v_d.lab_result is distinct from 'passed' then
      raise exception 'lab_failed_blocked';
    end if;
    update public.deliveries set status = 'paid' where id = p_delivery_id returning * into v_d;
  else
    raise exception 'invalid_step';
  end if;
  return v_d;
end;
$$;

create or replace function public.cancel_delivery(p_delivery_id uuid, p_reason text default null)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_d public.deliveries%rowtype;
  v_offer public.offers%rowtype;
begin
  select * into v_d from public.deliveries where id = p_delivery_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if auth.uid() is distinct from v_d.processor_id then
    raise exception 'forbidden';
  end if;
  if v_d.status = 'cancelled' then
    return v_d;
  end if;
  if v_d.status = 'paid' then
    raise exception 'delivery_locked';
  end if;
  if v_d.status = 'lab_checked' and v_d.lab_result is distinct from 'failed' then
    raise exception 'delivery_locked';
  end if;

  update public.deliveries
  set status = 'cancelled',
      notes = left(coalesce(nullif(trim(p_reason), ''), notes), 500)
  where id = p_delivery_id
  returning * into v_d;

  -- Failed lab: the olives go back, the lot is closed. Cancelled before weighing: lot returns to the market.
  update public.lots
  set status = case when v_d.lab_result = 'failed' then 'withdrawn'::public.lot_status else 'listed'::public.lot_status end,
      identity_unlocked_for = array_remove(identity_unlocked_for, v_d.processor_id)
  where id = v_d.lot_id and status = 'reserved';

  select * into v_offer from public.offers where id = v_d.offer_id;
  if v_offer.buy_request_id is not null then
    update public.buy_requests
    set filled_tons = greatest(0, filled_tons - v_d.tons)
    where id = v_offer.buy_request_id;
  end if;
  return v_d;
end;
$$;

revoke all on function public.accept_offer(uuid, date, integer) from public, anon;
revoke all on function public.counter_offer(uuid, numeric) from public, anon;
revoke all on function public.advance_delivery(uuid, public.delivery_status, numeric, public.lab_result) from public, anon;
revoke all on function public.cancel_delivery(uuid, text) from public, anon;
grant execute on function public.accept_offer(uuid, date, integer) to authenticated;
grant execute on function public.counter_offer(uuid, numeric) to authenticated;
grant execute on function public.advance_delivery(uuid, public.delivery_status, numeric, public.lab_result) to authenticated;
grant execute on function public.cancel_delivery(uuid, text) to authenticated;

-- Trigger-only helpers must not be callable as RPC
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.on_offer_accepted() from public, anon, authenticated;
revoke all on function public.on_delivery_paid() from public, anon, authenticated;
revoke all on function public.bump_buy_request_on_accept() from public, anon, authenticated;

notify pgrst, 'reload schema';
