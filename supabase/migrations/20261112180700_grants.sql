-- Privileges for the Supabase API roles.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;

grant select on public.marketplace_lots to authenticated, service_role;

-- Ensure future tables inherit the same defaults.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
