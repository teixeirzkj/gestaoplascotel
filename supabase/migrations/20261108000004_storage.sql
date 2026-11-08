-- =============================================================================
-- PLASCOTEL — Storage privado para comprovantes
-- Caminho: payments/<payment_id>/<arquivo>. Acesso apenas por URL assinada.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy receipts_read on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and public.is_active_user());

create policy receipts_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts' and public.is_active_user()
    and (storage.foldername(name))[1] = 'payments'
    and exists (select 1 from public.payments p where p.id::text = (storage.foldername(name))[2])
  );
-- Sem políticas de update/delete: comprovantes não podem ser apagados ou substituídos.
