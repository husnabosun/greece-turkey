-- Buyer-facing spray history is computed by the DB from the field's logbook (last 12 months),
-- so a lot can never claim "no banned products" while the logbook says otherwise. Ν3.
create or replace function public.lot_spray_snapshot(p_field_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'product_name', e.product_name,
    'applied_at', e.applied_at,
    'eu_banned', e.eu_banned,
    'eu_status', e.eu_status,
    'pre_harvest_days', e.pre_harvest_days
  ) order by e.applied_at desc), '[]'::jsonb)
  from (
    select * from public.logbook_entries
    where field_id = p_field_id and kind = 'spray' and applied_at >= now() - interval '365 days'
    order by applied_at desc
    limit 20
  ) e;
$$;
revoke all on function public.lot_spray_snapshot(uuid) from public, anon, authenticated;

create or replace function public.lots_fill_spray_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.field_id is not null and (tg_op = 'INSERT' or new.status in ('draft', 'listed')) then
    new.spray_snapshot := public.lot_spray_snapshot(new.field_id);
    new.has_banned_spray := exists (
      select 1 from public.logbook_entries e
      where e.field_id = new.field_id and e.eu_banned and e.applied_at >= now() - interval '365 days'
    );
  end if;
  return new;
end;
$$;
revoke all on function public.lots_fill_spray_snapshot() from public, anon, authenticated;
drop trigger if exists lots_spray_snapshot on public.lots;
create trigger lots_spray_snapshot
  before insert or update on public.lots
  for each row execute function public.lots_fill_spray_snapshot();

-- When the farmer adds/deletes a spray, refresh open lots of that field.
create or replace function public.logbook_refresh_lots()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_field uuid := coalesce(new.field_id, old.field_id);
begin
  update public.lots set updated_at = now()
  where field_id = v_field and status in ('draft', 'listed');
  return coalesce(new, old);
end;
$$;
revoke all on function public.logbook_refresh_lots() from public, anon, authenticated;
drop trigger if exists logbook_entries_refresh_lots on public.logbook_entries;
create trigger logbook_entries_refresh_lots
  after insert or update or delete on public.logbook_entries
  for each row execute function public.logbook_refresh_lots();

-- backfill open lots
update public.lots set updated_at = now() where status in ('draft', 'listed') and field_id is not null;
notify pgrst, 'reload schema';
