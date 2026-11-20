-- Ensure accept → reserved lot + delivery always works (bypass RLS inside trigger).
create or replace function public.on_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Trigger must create delivery even though deliveries has no INSERT RLS policy.
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
      case
        when new.delivery_in_days is null then null
        else (timezone('utc', now()))::date + new.delivery_in_days
      end
    where not exists (
      select 1 from public.deliveries d where d.offer_id = new.id
    );
  end if;

  return new;
end;
$$;

-- Client-side safety net after accept if trigger missed the insert.
drop policy if exists deliveries_participants_insert_on_accept on public.deliveries;
create policy deliveries_participants_insert_on_accept
on public.deliveries for insert to authenticated
with check (
  (farmer_id = auth.uid() or processor_id = auth.uid())
  and exists (
    select 1 from public.offers o
    where o.id = offer_id
      and o.status = 'accepted'
      and o.farmer_id = deliveries.farmer_id
      and o.processor_id = deliveries.processor_id
      and o.lot_id = deliveries.lot_id
  )
);
