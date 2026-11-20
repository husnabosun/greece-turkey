-- Agro Pulse AI — Phase 2
-- Enable required Postgres extensions.

create extension if not exists "pgcrypto";
create extension if not exists "postgis";

-- Keep PostGIS objects in the extensions schema when available; otherwise public is fine on Supabase.
comment on extension postgis is 'Geospatial types and functions for olive grove polygons (EPSG:4326)';
