-- Always set a delivery date on accept when offer has no delivery_in_days.
create or replace function public.on_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('row_security', 'off', true);

  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.lots
    set
      status = 'reserved',
      identity_unlocked_for = (
        select array(
          select distinct x
          from unnest(coalesce(identity_unlocked_for, '{}') || array[new.processor_id]) as x
        )
      ),
      updated_at = now()
    where id = new.lot_id;

    insert into public.deliveries (
      offer_id, lot_id, farmer_id, processor_id, tons, price_per_kg, status, scheduled_for
    )
    select
      new.id,
      new.lot_id,
      new.farmer_id,
      new.processor_id,
      new.tons,
      new.price_per_kg,
      'scheduled',
      (timezone('utc', now()))::date + coalesce(new.delivery_in_days, 2)
    where not exists (
      select 1 from public.deliveries d where d.offer_id = new.id
    );
  end if;

  return new;
end;
$$;

-- Backfill open deliveries that never got a date.
update public.deliveries
set scheduled_for = (timezone('utc', now()))::date + 2
where scheduled_for is null
  and status is distinct from 'cancelled'
  and status is distinct from 'paid';
