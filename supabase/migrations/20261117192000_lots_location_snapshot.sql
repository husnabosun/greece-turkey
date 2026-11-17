-- Snapshot grove coordinates onto lots so processors can map listed supply
-- without reading fields until identity is unlocked.
alter table public.lots
  add column if not exists lat double precision,
  add column if not exists lon double precision;

create index if not exists lots_lat_lon_idx
  on public.lots (lat, lon)
  where lat is not null and lon is not null;

update public.lots l
set
  lat = f.lat,
  lon = f.lon
from public.fields f
where l.field_id = f.id
  and l.lat is null
  and f.lat is not null
  and f.lon is not null;

drop view if exists public.marketplace_lots;

create view public.marketplace_lots
with (security_invoker = true)
as
select
  l.id,
  l.status,
  l.use_type,
  l.variety,
  l.tons,
  l.price_per_kg,
  l.negotiable,
  l.delivery_mode,
  l.town,
  l.region,
  l.country,
  l.harvest_start,
  l.harvest_end,
  l.quality_score,
  l.quality_breakdown,
  l.spray_snapshot,
  l.has_banned_spray,
  l.lab_result,
  l.lab_acidity,
  l.lab_tested_at,
  l.listed_at,
  l.created_at,
  l.field_id,
  l.lat,
  l.lon,
  case
    when auth.uid() = l.farmer_id then l.farmer_id
    when auth.uid() = any (l.identity_unlocked_for) then l.farmer_id
    else null
  end as farmer_id,
  case
    when auth.uid() = l.farmer_id then p.display_name
    when auth.uid() = any (l.identity_unlocked_for) then p.display_name
    else null
  end as farmer_display_name
from public.lots l
join public.profiles p on p.id = l.farmer_id
where l.status in ('listed', 'reserved', 'sold');

grant select on public.marketplace_lots to authenticated, service_role;
