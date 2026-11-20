-- B2B marketplace: lots, processor buy requests, offers/bids, deliveries.

create table public.lots (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  field_id uuid references public.fields (id) on delete set null,
  status public.lot_status not null default 'draft',
  use_type public.lot_use not null default 'oil',
  variety text not null,
  tons numeric(10, 3) not null check (tons > 0),
  price_per_kg numeric(10, 4) check (price_per_kg is null or price_per_kg > 0),
  negotiable boolean not null default true,
  delivery_mode text check (delivery_mode is null or delivery_mode in ('pickup', 'deliver')),
  town text,
  region text not null,
  country public.country_code,
  harvest_start date,
  harvest_end date,
  quality_score integer check (quality_score is null or (quality_score >= 0 and quality_score <= 100)),
  quality_breakdown jsonb not null default '{}'::jsonb,
  -- Snapshot of sprays at listing time for processor due diligence.
  spray_snapshot jsonb not null default '[]'::jsonb,
  has_banned_spray boolean not null default false,
  lab_result public.lab_result,
  lab_acidity numeric(5, 3),
  lab_tested_at date,
  -- Farmer identity stays hidden from processors until an offer is accepted.
  identity_unlocked_for uuid[] not null default '{}',
  listed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lots_farmer_id_idx on public.lots (farmer_id);
create index lots_status_region_idx on public.lots (status, region);
create index lots_listed_at_idx on public.lots (listed_at desc nulls last);

create trigger lots_set_updated_at
before update on public.lots
for each row execute function public.set_updated_at();

create or replace function public.touch_lot_listed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'listed' and (old.status is distinct from 'listed') then
    new.listed_at := coalesce(new.listed_at, now());
  end if;
  return new;
end;
$$;

create trigger lots_touch_listed_at
before insert or update of status on public.lots
for each row execute function public.touch_lot_listed_at();

-- Processor purchase requests visible in the farmer Market > Requests feed.
create table public.buy_requests (
  id uuid primary key default gen_random_uuid(),
  processor_id uuid not null references public.profiles (id) on delete cascade,
  variety text not null,
  tons numeric(10, 3) not null check (tons > 0),
  filled_tons numeric(10, 3) not null default 0 check (filled_tons >= 0),
  min_score integer not null default 0 check (min_score >= 0 and min_score <= 100),
  region text,
  window_label text,
  no_banned boolean not null default false,
  shared_with_farmers boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index buy_requests_processor_id_idx on public.buy_requests (processor_id);
create index buy_requests_active_idx on public.buy_requests (active) where active;

create trigger buy_requests_set_updated_at
before update on public.buy_requests
for each row execute function public.set_updated_at();

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  processor_id uuid not null references public.profiles (id) on delete cascade,
  -- Who initiated: processor bid on a listed lot, or farmer response to a buy request.
  initiated_by public.user_role not null,
  status public.offer_status not null default 'pending',
  tons numeric(10, 3) not null check (tons > 0),
  price_per_kg numeric(10, 4) not null check (price_per_kg > 0),
  delivery_in_days integer check (delivery_in_days is null or delivery_in_days >= 0),
  counter_of uuid references public.offers (id) on delete set null,
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_parties_distinct check (farmer_id <> processor_id)
);

create index offers_lot_id_idx on public.offers (lot_id);
create index offers_farmer_status_idx on public.offers (farmer_id, status);
create index offers_processor_status_idx on public.offers (processor_id, status);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

-- Unlock farmer identity on the lot when an offer is accepted.
create or replace function public.on_offer_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

    -- Auto-create delivery pipeline row if missing.
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

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null unique references public.offers (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  processor_id uuid not null references public.profiles (id) on delete cascade,
  status public.delivery_status not null default 'scheduled',
  tons numeric(10, 3) not null check (tons > 0),
  price_per_kg numeric(10, 4) not null check (price_per_kg > 0),
  scheduled_for date,
  actual_kg numeric(12, 2) check (actual_kg is null or actual_kg > 0),
  weighed_at timestamptz,
  lab_result public.lab_result,
  lab_checked_at timestamptz,
  paid_at timestamptz,
  quality_score_snapshot integer,
  banned_free boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliveries_processor_status_idx on public.deliveries (processor_id, status);
create index deliveries_farmer_status_idx on public.deliveries (farmer_id, status);

create trigger deliveries_set_updated_at
before update on public.deliveries
for each row execute function public.set_updated_at();

create trigger offers_on_accepted
after update of status on public.offers
for each row execute function public.on_offer_accepted();

-- Mark lot sold when delivery is paid.
create or replace function public.on_delivery_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    new.paid_at := coalesce(new.paid_at, now());
    update public.lots
    set status = 'sold', updated_at = now()
    where id = new.lot_id;
  elsif new.status = 'weighed' and old.status is distinct from 'weighed' then
    new.weighed_at := coalesce(new.weighed_at, now());
  elsif new.status = 'lab_checked' and old.status is distinct from 'lab_checked' then
    new.lab_checked_at := coalesce(new.lab_checked_at, now());
  end if;
  return new;
end;
$$;

create trigger deliveries_on_status
before update of status on public.deliveries
for each row execute function public.on_delivery_paid();

-- Marketplace view: mask farmer display name until identity is unlocked for the viewer.
create or replace view public.marketplace_lots
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
