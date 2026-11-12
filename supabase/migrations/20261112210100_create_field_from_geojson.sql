-- Allow authenticated farmers to insert a field polygon via GeoJSON.
-- PostGIS lives in the `extensions` schema on this Supabase project.
create or replace function public.create_field_from_geojson(
  p_name text,
  p_geojson text,
  p_variety text default null
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

  insert into public.fields (farmer_id, name, variety, geom)
  values (auth.uid(), trim(p_name), nullif(trim(p_variety), ''), v_geom)
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_field_from_geojson(text, text, text) to authenticated;
