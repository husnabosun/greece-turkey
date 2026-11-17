-- Farmers need mill company/display names on shared buy requests (Offer CTA cards).
create policy profiles_select_buy_request_processor
on public.profiles for select to authenticated
using (
  public.is_farmer()
  and exists (
    select 1
    from public.buy_requests br
    where br.processor_id = profiles.id
      and br.active
      and br.shared_with_farmers
  )
);
