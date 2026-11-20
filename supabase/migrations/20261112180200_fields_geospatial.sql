-- Olive grove fields (PostGIS polygons) + optional tree markers.

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  variety text,
  irrigated boolean not null default false,
  tree_count integer check (tree_count is null or tree_count >= 0),
  proof_level public.proof_level not null default 'self_reported',
  -- WGS84 polygon drawn in Mapbox / stored for AgroMonitoring & weather centroid.
  geom geometry(Polygon, 4326),
  centroid geometry(Point, 4326),
  area_ha numeric(10, 4),
  -- Denormalised weather pin when geom is not drawn yet.
  lat double precision,
  lon double precision,
  pruned_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fields_coords_chk check (
    (lat is null and lon is null) or (lat between -90 and 90 and lon between -180 and 180)
  )
);

create index fields_farmer_id_idx on public.fields (farmer_id);
create index fields_geom_gix on public.fields using gist (geom);
create index fields_centroid_gix on public.fields using gist (centroid);

create or replace function public.set_field_geometry_derived()
returns trigger
language plpgsql
as $$
begin
  if new.geom is not null then
    if not st_isvalid(new.geom) then
      raise exception 'fields.geom must be a valid Polygon';
    end if;
    -- Area in hectares via geography (true spheroid metres).
    new.area_ha := round((st_area(new.geom::geography) / 10000.0)::numeric, 4);
    new.centroid := st_centroid(new.geom);
    new.lat := st_y(new.centroid);
    new.lon := st_x(new.centroid);
  elsif new.lat is not null and new.lon is not null then
    new.centroid := st_setsrid(st_makepoint(new.lon, new.lat), 4326);
  end if;
  return new;
end;
$$;

create trigger fields_geometry_derived
before insert or update of geom, lat, lon on public.fields
for each row execute function public.set_field_geometry_derived();

create trigger fields_set_updated_at
before update on public.fields
for each row execute function public.set_updated_at();

create table public.field_trees (
  id uuid primary key default gen_random_uuid(),
  field_id uuid not null references public.fields (id) on delete cascade,
  -- Relative map position (0–100) for UI markers, or absolute geom when surveyed.
  x_pct numeric(5, 2) check (x_pct is null or (x_pct >= 0 and x_pct <= 100)),
  y_pct numeric(5, 2) check (y_pct is null or (y_pct >= 0 and y_pct <= 100)),
  geom geometry(Point, 4326),
  status public.tree_status not null default 'healthy',
  issue text,
  last_photo_at timestamptz,
  last_spray_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index field_trees_field_id_idx on public.field_trees (field_id);
create index field_trees_geom_gix on public.field_trees using gist (geom);

create trigger field_trees_set_updated_at
before update on public.field_trees
for each row execute function public.set_updated_at();
