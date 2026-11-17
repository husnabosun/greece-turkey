-- Allow offer participants to see each other's public profile names before unlock/delivery.
create policy profiles_select_offer_counterparty
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.offers o
    where (o.processor_id = profiles.id and o.farmer_id = auth.uid())
       or (o.farmer_id = profiles.id and o.processor_id = auth.uid())
  )
);
