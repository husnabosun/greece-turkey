-- Olive variety catalog with agronomic metadata (GR + TR + other).
-- Compatible with existing fields.variety text: add variety_slug FK and backfill.

do $$ begin
  create type public.olive_origin_country as enum ('GR', 'TR', 'BOTH');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.olive_primary_use as enum ('OIL', 'TABLE', 'DUAL');
exception when duplicate_object then null;
end $$;

create table if not exists public.olive_varieties (
  slug text primary key,
  name_en text not null,
  name_el text not null,
  name_tr text not null,
  origin_country public.olive_origin_country not null,
  primary_use public.olive_primary_use not null,
  avg_oil_yield_min numeric(5, 2) not null check (avg_oil_yield_min >= 0 and avg_oil_yield_min <= 100),
  avg_oil_yield_max numeric(5, 2) not null check (avg_oil_yield_max >= 0 and avg_oil_yield_max <= 100),
  harvest_window_months integer[] not null default '{}',
  disease_susceptibility jsonb not null default '{}'::jsonb,
  drought_tolerance integer not null check (drought_tolerance between 1 and 5),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint olive_varieties_yield_range check (avg_oil_yield_max >= avg_oil_yield_min),
  constraint olive_varieties_disease_shape check (jsonb_typeof(disease_susceptibility) = 'object')
);

comment on table public.olive_varieties is
  'Canonical olive cultivars for fields, diagnostics, risk and marketplace.';
comment on column public.olive_varieties.disease_susceptibility is
  'Scores 1–5 for bactrocera_oleae, spilocaea_oleagina, colletotrichum, pseudomonas_savastanoi.';

create index if not exists olive_varieties_origin_idx on public.olive_varieties (origin_country);
create index if not exists olive_varieties_use_idx on public.olive_varieties (primary_use);

alter table public.fields
  add column if not exists variety_slug text references public.olive_varieties (slug);

create index if not exists fields_variety_slug_idx on public.fields (variety_slug);

insert into public.olive_varieties (
  slug, name_en, name_el, name_tr, origin_country, primary_use,
  avg_oil_yield_min, avg_oil_yield_max, harvest_window_months,
  disease_susceptibility, drought_tolerance, sort_order
) values
  (
    'koroneiki', 'Koroneiki', 'Κορωνέικη', 'Koroneiki',
    'GR', 'OIL', 18, 25, array[10, 11, 12],
    '{"bactrocera_oleae":4,"spilocaea_oleagina":4,"colletotrichum":3,"pseudomonas_savastanoi":2}'::jsonb,
    2, 10
  ),
  (
    'kalamon', 'Kalamon', 'Καλαμών', 'Kalamata',
    'GR', 'DUAL', 15, 18, array[11, 12],
    '{"bactrocera_oleae":5,"spilocaea_oleagina":3,"colletotrichum":5,"pseudomonas_savastanoi":2}'::jsonb,
    3, 20
  ),
  (
    'athinolia', 'Athinolia (Mastoeidis)', 'Αθηνολιά / Μαστοειδής', 'Athinolia',
    'GR', 'OIL', 20, 25, array[10, 11, 12],
    '{"bactrocera_oleae":3,"spilocaea_oleagina":2,"colletotrichum":2,"pseudomonas_savastanoi":2}'::jsonb,
    4, 30
  ),
  (
    'manaki', 'Manaki (Kothreiki)', 'Μανάκι / Κοθρέικη', 'Manaki',
    'GR', 'OIL', 18, 22, array[11, 12],
    '{"bactrocera_oleae":2,"spilocaea_oleagina":2,"colletotrichum":2,"pseudomonas_savastanoi":1}'::jsonb,
    3, 40
  ),
  (
    'chalkidiki', 'Chondrolia Chalkidikis', 'Χονδρολιά Χαλκιδικής', 'Halkidiki',
    'GR', 'TABLE', 14, 17, array[9, 10],
    '{"bactrocera_oleae":5,"spilocaea_oleagina":3,"colletotrichum":4,"pseudomonas_savastanoi":2}'::jsonb,
    2, 50
  ),
  (
    'konservolia', 'Konservolia (Amfissis)', 'Κονσερβολιά / Αμφίσσης', 'Konservolia',
    'GR', 'TABLE', 16, 19, array[9, 10, 11],
    '{"bactrocera_oleae":5,"spilocaea_oleagina":4,"colletotrichum":3,"pseudomonas_savastanoi":2}'::jsonb,
    3, 60
  ),
  (
    'ayvalik', 'Ayvalık', 'Αϊβαλί', 'Ayvalık',
    'TR', 'OIL', 20, 24, array[10, 11, 12],
    '{"bactrocera_oleae":4,"spilocaea_oleagina":3,"colletotrichum":3,"pseudomonas_savastanoi":2}'::jsonb,
    3, 110
  ),
  (
    'memecik', 'Memecik', 'Μεμετζίκ', 'Memecik',
    'TR', 'OIL', 18, 22, array[11, 12],
    '{"bactrocera_oleae":4,"spilocaea_oleagina":3,"colletotrichum":3,"pseudomonas_savastanoi":2}'::jsonb,
    3, 120
  ),
  (
    'gemlik', 'Gemlik', 'Γκεμλίκ', 'Gemlik',
    'TR', 'DUAL', 16, 20, array[10, 11],
    '{"bactrocera_oleae":4,"spilocaea_oleagina":3,"colletotrichum":3,"pseudomonas_savastanoi":2}'::jsonb,
    3, 130
  ),
  (
    'other', 'Other / Local', 'Άλλη / Τοπική', 'Diğer / Yerel',
    'BOTH', 'DUAL', 15, 22, array[10, 11, 12],
    '{"bactrocera_oleae":3,"spilocaea_oleagina":3,"colletotrichum":3,"pseudomonas_savastanoi":3}'::jsonb,
    3, 900
  )
on conflict (slug) do update set
  name_en = excluded.name_en,
  name_el = excluded.name_el,
  name_tr = excluded.name_tr,
  origin_country = excluded.origin_country,
  primary_use = excluded.primary_use,
  avg_oil_yield_min = excluded.avg_oil_yield_min,
  avg_oil_yield_max = excluded.avg_oil_yield_max,
  harvest_window_months = excluded.harvest_window_months,
  disease_susceptibility = excluded.disease_susceptibility,
  drought_tolerance = excluded.drought_tolerance,
  sort_order = excluded.sort_order;

update public.fields f
set variety_slug = v.slug
from public.olive_varieties v
where f.variety_slug is null
  and f.variety is not null
  and (
    lower(trim(f.variety)) = v.slug
    or lower(trim(f.variety)) = lower(v.name_en)
    or lower(trim(f.variety)) = lower(v.name_el)
    or lower(trim(f.variety)) = lower(v.name_tr)
  );

update public.fields set variety_slug = 'ayvalik'
where variety_slug is null and variety is not null
  and lower(translate(trim(variety), 'İı', 'ii')) similar to '(ayvalik|ayvalık)';

update public.fields set variety_slug = 'kalamon'
where variety_slug is null and variety is not null
  and lower(trim(variety)) in ('kalamon', 'kalamata', 'καλαμών');

update public.fields set variety_slug = 'koroneiki'
where variety_slug is null and variety is not null
  and lower(trim(variety)) in ('koroneiki', 'κορωνέικη');

update public.fields set variety_slug = 'other'
where variety_slug is null and variety is not null
  and lower(trim(variety)) in ('other', 'άλλη', 'diğer', 'diger');

alter table public.olive_varieties enable row level security;

drop policy if exists olive_varieties_read_all on public.olive_varieties;
create policy olive_varieties_read_all
on public.olive_varieties for select
to authenticated, anon
using (true);

grant select on public.olive_varieties to anon, authenticated, service_role;

-- Replace create_field RPC: same 7-arg call sites keep working via default p_variety_slug
drop function if exists public.create_field_from_geojson(text, text, text, integer, boolean, public.proof_level, text);

create or replace function public.create_field_from_geojson(
  p_name text,
  p_geojson text,
  p_variety text default null,
  p_tree_count integer default null,
  p_irrigated boolean default false,
  p_proof_level public.proof_level default 'self_reported',
  p_notes text default null,
  p_variety_slug text default null
)
returns public.fields
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_row public.fields;
  v_geom extensions.geometry(Polygon, 4326);
  v_slug text;
  v_label text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_farmer() then
    raise exception 'only farmers can create fields';
  end if;
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'name is required';
  end if;

  v_geom := extensions.st_setsrid(extensions.st_geomfromgeojson(p_geojson), 4326);
  if extensions.geometrytype(v_geom) <> 'POLYGON' then
    raise exception 'geojson must be a Polygon';
  end if;

  v_slug := nullif(trim(coalesce(p_variety_slug, '')), '');
  if v_slug is null and p_variety is not null and length(trim(p_variety)) > 0 then
    select ov.slug into v_slug
    from public.olive_varieties ov
    where ov.slug = lower(trim(p_variety))
       or lower(ov.name_en) = lower(trim(p_variety))
       or lower(ov.name_el) = lower(trim(p_variety))
       or lower(ov.name_tr) = lower(trim(p_variety))
    limit 1;
  end if;

  if v_slug is not null and not exists (select 1 from public.olive_varieties ov where ov.slug = v_slug) then
    v_slug := 'other';
  end if;

  select coalesce(
    (select name_en from public.olive_varieties where slug = v_slug),
    nullif(trim(p_variety), '')
  ) into v_label;

  insert into public.fields (
    farmer_id,
    name,
    variety,
    variety_slug,
    geom,
    tree_count,
    irrigated,
    proof_level,
    notes
  )
  values (
    auth.uid(),
    trim(p_name),
    v_label,
    v_slug,
    v_geom,
    p_tree_count,
    coalesce(p_irrigated, false),
    coalesce(p_proof_level, 'self_reported'),
    nullif(trim(p_notes), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_field_from_geojson(
  text, text, text, integer, boolean, public.proof_level, text, text
) to authenticated;
