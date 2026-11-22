-- Oil as a first-class marketplace product (separate from lots.use_type).
-- use_type remains "olives meant for oil" vs "table olives".
-- Quantity stays in `tons` for both products (oil UI shows kg = tons * 1000).

create type public.product_kind as enum ('oil', 'olives');

-- ---------- lots ----------
alter table public.lots
  add column if not exists product public.product_kind not null default 'olives',
  add column if not exists oil_category text,
  add column if not exists acidity numeric(4, 2),
  add column if not exists harvest_season text,
  add column if not exists storage text,
  add column if not exists peroxide numeric(6, 2),
  add column if not exists polyphenols integer,
  add column if not exists pdo_pgi text,
  add column if not exists organic boolean not null default false;

alter table public.lots drop constraint if exists lots_oil_category_chk;
alter table public.lots add constraint lots_oil_category_chk
  check (oil_category is null or oil_category in ('extra_virgin', 'virgin', 'lampante'));

alter table public.lots drop constraint if exists lots_acidity_chk;
alter table public.lots add constraint lots_acidity_chk
  check (acidity is null or (acidity >= 0 and acidity <= 10));

alter table public.lots drop constraint if exists lots_storage_chk;
alter table public.lots add constraint lots_storage_chk
  check (storage is null or storage in ('tank', 'ibc', 'tins', 'bottles'));

alter table public.lots drop constraint if exists lots_oil_required_chk;
alter table public.lots add constraint lots_oil_required_chk
  check (
    product <> 'oil'
    or (oil_category is not null and acidity is not null)
  );

create index if not exists lots_product_status_idx on public.lots (product, status);

-- Oil can be listed from 50 kg (0.05 t) and priced up to €30/kg.
alter table public.lots drop constraint if exists lots_tons_range_chk;
alter table public.lots add constraint lots_tons_range_chk check (
  (product = 'oil' and tons >= 0.05 and tons <= 500)
  or (product = 'olives' and tons >= 0.1 and tons <= 500)
);

alter table public.lots drop constraint if exists lots_price_range_chk;
alter table public.lots add constraint lots_price_range_chk check (
  price_per_kg is null
  or (product = 'oil' and price_per_kg >= 1 and price_per_kg <= 30)
  or (product = 'olives' and price_per_kg >= 0.05 and price_per_kg <= 20)
);

alter table public.offers drop constraint if exists offers_price_range_chk;
alter table public.offers add constraint offers_price_range_chk check (
  price_per_kg >= 0.05 and price_per_kg <= 30
);

-- ---------- buy_requests ----------
alter table public.buy_requests
  add column if not exists product public.product_kind not null default 'olives',
  add column if not exists max_acidity numeric(4, 2),
  add column if not exists oil_category text;

alter table public.buy_requests drop constraint if exists buy_requests_oil_category_chk;
alter table public.buy_requests add constraint buy_requests_oil_category_chk
  check (oil_category is null or oil_category in ('extra_virgin', 'virgin', 'lampante'));

alter table public.buy_requests drop constraint if exists buy_requests_max_acidity_chk;
alter table public.buy_requests add constraint buy_requests_max_acidity_chk
  check (max_acidity is null or (max_acidity >= 0 and max_acidity <= 10));

create index if not exists buy_requests_product_active_idx
  on public.buy_requests (product, active)
  where active;

-- Refresh marketplace view so product / oil columns are readable wherever lots are.
drop view if exists public.marketplace_lots;

create view public.marketplace_lots
with (security_invoker = true)
as
select
  l.id,
  l.status,
  l.product,
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
  l.oil_category,
  l.acidity,
  l.harvest_season,
  l.storage,
  l.peroxide,
  l.polyphenols,
  l.pdo_pgi,
  l.organic,
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

comment on type public.product_kind is 'Marketplace tradable product: bulk olive oil or olives (fruit).';
comment on column public.lots.product is 'oil | olives — distinct from use_type (oil/table olives purpose).';
comment on column public.lots.tons is 'Stored quantity for both products; oil UI displays kg = tons * 1000.';

-- Allow oil counter-offers up to €30/kg (was hard-capped at 20 in security_hardening).
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
  if p_price_per_kg is null or p_price_per_kg < 0.05 or p_price_per_kg > 30 then
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
