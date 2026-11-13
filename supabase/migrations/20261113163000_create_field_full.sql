-- Extend field creation with trees / irrigation / proof + onboarding notes.
alter table public.fields
  alter column notes type text;

create or replace function public.create_field_from_geojson(
  p_name text,
  p_geojson text,
  p_variety text default null,
  p_tree_count integer default null,
  p_irrigated boolean default false,
  p_proof_level public.proof_level default 'self_reported',
  p_notes text default null
)
returns public.fields
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_row public.fields;
  v_geom extensions.geometry(Polygon, 4326);
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

  insert into public.fields (
    farmer_id,
    name,
    variety,
    geom,
    tree_count,
    irrigated,
    proof_level,
    notes
  )
  values (
    auth.uid(),
    trim(p_name),
    nullif(trim(p_variety), ''),
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

grant execute on function public.create_field_from_geojson(text, text, text, integer, boolean, public.proof_level, text) to authenticated;
