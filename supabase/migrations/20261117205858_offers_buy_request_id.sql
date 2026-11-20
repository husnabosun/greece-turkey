-- Link farmer→mill offers to a specific buy request (Flow B).
alter table public.offers
  add column if not exists buy_request_id uuid references public.buy_requests (id) on delete set null;

create index if not exists offers_buy_request_id_idx
  on public.offers (buy_request_id)
  where buy_request_id is not null;

-- When a linked offer is accepted, bump the request fill progress.
create or replace function public.bump_buy_request_on_accept()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted'
     and (old.status is distinct from 'accepted')
     and new.buy_request_id is not null then
    update public.buy_requests
    set filled_tons = least(tons, filled_tons + new.tons),
        updated_at = now()
    where id = new.buy_request_id;
  end if;
  return new;
end;
$$;

drop trigger if exists offers_bump_buy_request on public.offers;
create trigger offers_bump_buy_request
after update of status on public.offers
for each row
execute function public.bump_buy_request_on_accept();
