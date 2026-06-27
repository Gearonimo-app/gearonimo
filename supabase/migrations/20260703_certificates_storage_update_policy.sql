-- Bij "Afronden" van een keuring faalde de upload van het certificaat-PDF met
-- "new row violates row-level security policy". Oorzaak: de upload gaat naar de
-- Storage-bucket 'certificates' (storage.objects), die altijd RLS aan heeft. De
-- insert-policy bestond al (20260624_certificates.sql), maar:
--   1) op de live database ontbrak hij (drift t.o.v. de migraties), en
--   2) het afronden gebruikt nu storage-upsert (overschrijven bij opnieuw
--      afronden na een halve poging), wat naast INSERT ook een UPDATE-policy
--      nodig heeft.
-- Deze migratie (her)bevestigt de bucket + de insert-policy en voegt de
-- ontbrekende update-policy toe. Idempotent (drop policy if exists).

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

drop policy if exists "certificates upload by authenticated" on storage.objects;
create policy "certificates upload by authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'certificates');

drop policy if exists "certificates update by authenticated" on storage.objects;
create policy "certificates update by authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'certificates')
  with check (bucket_id = 'certificates');
