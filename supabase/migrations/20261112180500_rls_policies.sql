-- Row Level Security: farmer owns field data; processor sees marketplace surface + own bids/deliveries.

alter table public.profiles enable row level security;
alter table public.fields enable row level security;
alter table public.field_trees enable row level security;
alter table public.scans enable row level security;
alter table public.logbook_entries enable row level security;
alter table public.quality_scores enable row level security;
alter table public.tasks enable row level security;
alter table public.risk_snapshots enable row level security;
alter table public.lots enable row level security;
alter table public.buy_requests enable row level security;
alter table public.offers enable row level security;
alter table public.deliveries enable row level security;

-- ---------- profiles ----------
create policy profiles_select_own
on public.profiles for select to authenticated
using (id = auth.uid());

create policy profiles_select_unlocked_counterparty
on public.profiles for select to authenticated
using (
  exists (
    select 1 from public.lots l
    where l.farmer_id = profiles.id
      and auth.uid() = any (l.identity_unlocked_for)
  )
  or exists (
    select 1 from public.deliveries d
    where (d.farmer_id = profiles.id and d.processor_id = auth.uid())
       or (d.processor_id = profiles.id and d.farmer_id = auth.uid())
  )
);

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- ---------- fields ----------
create policy fields_farmer_all
on public.fields for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

-- Processors may read field geometry/meta only for lots whose identity they unlocked
-- (traceability after deal). Spray/scan detail stays on lot snapshots + explicit grants.
create policy fields_processor_read_unlocked
on public.fields for select to authenticated
using (
  public.is_processor()
  and exists (
    select 1 from public.lots l
    where l.field_id = fields.id
      and auth.uid() = any (l.identity_unlocked_for)
  )
);

-- ---------- field_trees ----------
create policy field_trees_farmer_all
on public.field_trees for all to authenticated
using (
  exists (select 1 from public.fields f where f.id = field_trees.field_id and f.farmer_id = auth.uid())
)
with check (
  exists (select 1 from public.fields f where f.id = field_trees.field_id and f.farmer_id = auth.uid())
);

-- ---------- scans ----------
create policy scans_farmer_all
on public.scans for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

create policy scans_processor_read_unlocked
on public.scans for select to authenticated
using (
  public.is_processor()
  and exists (
    select 1 from public.lots l
    where l.field_id = scans.field_id
      and auth.uid() = any (l.identity_unlocked_for)
  )
);

-- ---------- logbook ----------
create policy logbook_farmer_all
on public.logbook_entries for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

create policy logbook_processor_read_unlocked
on public.logbook_entries for select to authenticated
using (
  public.is_processor()
  and exists (
    select 1 from public.lots l
    where l.field_id = logbook_entries.field_id
      and auth.uid() = any (l.identity_unlocked_for)
  )
);

-- ---------- quality_scores ----------
create policy quality_farmer_all
on public.quality_scores for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

create policy quality_processor_read_listed_or_unlocked
on public.quality_scores for select to authenticated
using (
  public.is_processor()
  and exists (
    select 1 from public.lots l
    where l.field_id = quality_scores.field_id
      and (
        l.status = 'listed'
        or auth.uid() = any (l.identity_unlocked_for)
      )
  )
);

-- ---------- tasks / risk ----------
create policy tasks_farmer_all
on public.tasks for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

create policy risk_farmer_all
on public.risk_snapshots for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

-- ---------- lots ----------
create policy lots_farmer_all
on public.lots for all to authenticated
using (farmer_id = auth.uid())
with check (farmer_id = auth.uid() and public.is_farmer());

create policy lots_processor_read_marketplace
on public.lots for select to authenticated
using (
  public.is_processor()
  and (
    status = 'listed'
    or auth.uid() = any (identity_unlocked_for)
    or exists (
      select 1 from public.offers o
      where o.lot_id = lots.id and o.processor_id = auth.uid()
    )
  )
);

-- ---------- buy_requests ----------
create policy buy_requests_processor_all
on public.buy_requests for all to authenticated
using (processor_id = auth.uid())
with check (processor_id = auth.uid() and public.is_processor());

create policy buy_requests_farmer_read_shared
on public.buy_requests for select to authenticated
using (public.is_farmer() and shared_with_farmers and active);

-- ---------- offers ----------
create policy offers_participants_select
on public.offers for select to authenticated
using (farmer_id = auth.uid() or processor_id = auth.uid());

create policy offers_processor_insert
on public.offers for insert to authenticated
with check (
  public.is_processor()
  and processor_id = auth.uid()
  and initiated_by = 'processor'
  and exists (
    select 1 from public.lots l
    where l.id = offers.lot_id
      and l.status = 'listed'
      and l.farmer_id = offers.farmer_id
  )
);

create policy offers_farmer_insert
on public.offers for insert to authenticated
with check (
  public.is_farmer()
  and farmer_id = auth.uid()
  and initiated_by = 'farmer'
  and exists (
    select 1 from public.lots l
    where l.id = lot_id and l.farmer_id = auth.uid()
  )
);

create policy offers_farmer_update
on public.offers for update to authenticated
using (farmer_id = auth.uid() and public.is_farmer())
with check (farmer_id = auth.uid());

create policy offers_processor_update
on public.offers for update to authenticated
using (processor_id = auth.uid() and public.is_processor())
with check (processor_id = auth.uid());

-- ---------- deliveries ----------
create policy deliveries_participants_select
on public.deliveries for select to authenticated
using (farmer_id = auth.uid() or processor_id = auth.uid());

-- Deliveries are created by the offer-accept trigger (security definer).
-- Processors advance weighbridge / lab / paid; farmers may read.
create policy deliveries_processor_update
on public.deliveries for update to authenticated
using (processor_id = auth.uid() and public.is_processor())
with check (processor_id = auth.uid());

create policy deliveries_farmer_update_notes
on public.deliveries for update to authenticated
using (farmer_id = auth.uid() and public.is_farmer())
with check (farmer_id = auth.uid());
