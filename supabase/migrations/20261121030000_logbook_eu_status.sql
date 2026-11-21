-- EU check result with an explicit "unknown" (never shown as approved). Η1 / Ν3.
alter table public.logbook_entries add column if not exists eu_status text not null default 'unknown';
alter table public.logbook_entries drop constraint if exists logbook_entries_eu_status_chk;
alter table public.logbook_entries add constraint logbook_entries_eu_status_chk check (eu_status in ('banned', 'allowed', 'unknown'));
-- keep the boolean consistent with the status
create or replace function public.logbook_sync_eu_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.eu_banned then
    new.eu_status := 'banned';
  elsif new.eu_status = 'banned' then
    new.eu_banned := true;
  end if;
  return new;
end;
$$;
drop trigger if exists logbook_entries_sync_eu on public.logbook_entries;
create trigger logbook_entries_sync_eu
  before insert or update on public.logbook_entries
  for each row execute function public.logbook_sync_eu_status();
update public.logbook_entries set eu_status = 'banned' where eu_banned;
notify pgrst, 'reload schema';
