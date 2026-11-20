-- Storage buckets for scan/label/proof images + Realtime for B2B tables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'scan-images',
    'scan-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'label-images',
    'label-images',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'proofs',
    'proofs',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  )
on conflict (id) do nothing;

-- Path convention: `{user_id}/{object_name}`
create policy storage_scan_images_own
on storage.objects for all to authenticated
using (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'scan-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_label_images_own
on storage.objects for all to authenticated
using (bucket_id = 'label-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'label-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy storage_proofs_own
on storage.objects for all to authenticated
using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Processor read of unlocked lot scan images (path still owned by farmer user id).
create policy storage_scan_images_processor_unlocked
on storage.objects for select to authenticated
using (
  bucket_id = 'scan-images'
  and public.is_processor()
  and exists (
    select 1
    from public.scans s
    join public.lots l on l.field_id = s.field_id
    where s.storage_path = name
      and auth.uid() = any (l.identity_unlocked_for)
  )
);

-- Realtime: live bids and delivery pipeline updates across farmer / processor UIs.
alter publication supabase_realtime add table public.offers;
alter publication supabase_realtime add table public.deliveries;
alter publication supabase_realtime add table public.lots;
