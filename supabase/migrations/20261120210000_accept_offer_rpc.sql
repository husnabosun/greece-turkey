-- Atomic accept: only pending offers on listed lots; reject sibling open offers.
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
  v_lot_status public.lot_status;
  v_delivery_id uuid;
  v_days integer;
  v_scheduled date;
begin
  perform set_config('row_security', 'off', true);

  select * into v_offer
  from public.offers
  where id = p_offer_id
  for update;

  if not found then
    raise exception 'offer_not_found';
  end if;

  if auth.uid() is distinct from v_offer.farmer_id
     and auth.uid() is distinct from v_offer.processor_id then
    raise exception 'forbidden';
  end if;

  -- Idempotent: already accepted → return existing delivery.
  if v_offer.status = 'accepted' then
    select id into v_delivery_id from public.deliveries where offer_id = p_offer_id;
    return v_delivery_id;
  end if;

  if v_offer.status is distinct from 'pending' then
    raise exception 'offer_not_pending';
  end if;

  select status into v_lot_status
  from public.lots
  where id = v_offer.lot_id
  for update;

  if v_lot_status is distinct from 'listed' then
    raise exception 'lot_not_listed';
  end if;

  v_days := coalesce(p_delivery_in_days, v_offer.delivery_in_days, 2);
  v_scheduled := coalesce(
    p_scheduled_for,
    (timezone('utc', now()))::date + v_days
  );

  -- Close every other open bid / counter on this lot.
  update public.offers
  set status = 'rejected', updated_at = now()
  where lot_id = v_offer.lot_id
    and id is distinct from p_offer_id
    and status in ('pending', 'countered');

  update public.offers
  set
    status = 'accepted',
    delivery_in_days = v_days,
    updated_at = now()
  where id = p_offer_id;

  -- Trigger on_offer_accepted inserts the delivery; ensure schedule.
  select id into v_delivery_id from public.deliveries where offer_id = p_offer_id;

  if v_delivery_id is null then
    insert into public.deliveries (
      offer_id, lot_id, farmer_id, processor_id, tons, price_per_kg, status, scheduled_for
    ) values (
      v_offer.id,
      v_offer.lot_id,
      v_offer.farmer_id,
      v_offer.processor_id,
      v_offer.tons,
      v_offer.price_per_kg,
      'scheduled',
      v_scheduled
    )
    returning id into v_delivery_id;
  elsif p_scheduled_for is not null then
    update public.deliveries
    set scheduled_for = v_scheduled
    where id = v_delivery_id;
  end if;

  return v_delivery_id;
end;
$$;

revoke all on function public.accept_offer(uuid, date, integer) from public;
grant execute on function public.accept_offer(uuid, date, integer) to authenticated;
