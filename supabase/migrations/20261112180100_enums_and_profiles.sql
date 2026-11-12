-- Enums + profiles (1:1 with auth.users) + RBAC helpers.

create type public.user_role as enum ('farmer', 'processor');
create type public.locale_code as enum ('el', 'tr', 'en');
create type public.country_code as enum ('GR', 'TR');
create type public.proof_level as enum ('self_reported', 'evidence_based', 'lab_verified');
create type public.scan_mode as enum ('leaf', 'fruit', 'trap', 'label');
create type public.tree_status as enum ('healthy', 'suspicious', 'diseased');
create type public.lot_use as enum ('oil', 'table');
create type public.lot_status as enum ('draft', 'listed', 'reserved', 'sold', 'withdrawn');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'countered', 'withdrawn');
create type public.delivery_status as enum ('scheduled', 'weighed', 'lab_checked', 'paid', 'cancelled');
create type public.lab_result as enum ('passed', 'failed');
create type public.task_kind as enum ('photo', 'spray', 'recheck', 'plain');
create type public.logbook_kind as enum ('spray', 'fertilizer', 'other');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null,
  display_name text,
  company_name text,
  locale public.locale_code not null default 'el',
  country public.country_code,
  phone text,
  place text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_processor_company_chk check (
    role <> 'processor' or company_name is not null
  )
);

create index profiles_role_idx on public.profiles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-create a profile row when a user signs up (role passed via raw_user_meta_data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role public.user_role;
  chosen_locale public.locale_code;
begin
  begin
    chosen_role := coalesce(
      (new.raw_user_meta_data ->> 'role')::public.user_role,
      'farmer'
    );
  exception when others then
    chosen_role := 'farmer';
  end;

  begin
    chosen_locale := coalesce(
      (new.raw_user_meta_data ->> 'locale')::public.locale_code,
      'el'
    );
  exception when others then
    chosen_locale := 'el';
  end;

  insert into public.profiles (id, role, display_name, company_name, locale, country)
  values (
    new.id,
    chosen_role,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.email),
    new.raw_user_meta_data ->> 'company_name',
    chosen_locale,
    nullif(new.raw_user_meta_data ->> 'country', '')::public.country_code
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Session helpers used by RLS policies.
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_farmer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'farmer'
  );
$$;

create or replace function public.is_processor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'processor'
  );
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_farmer() from public;
revoke all on function public.is_processor() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_farmer() to authenticated;
grant execute on function public.is_processor() to authenticated;
