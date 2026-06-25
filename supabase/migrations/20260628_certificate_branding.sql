-- Certificaat-opmaak per keurbedrijf (onderdeel 2 van de Instellingen-tegel,
-- besluit Jos 2026-06-25: alles per keurbedrijf, niet per land). Voegt een
-- logo en een vrije opmaak-configuratie toe aan inspection_companies, plus een
-- publieke Storage-bucket voor de logo's.
--
-- logo_path  : pad in de 'branding'-bucket naar het bedrijfslogo (png/jpg).
-- cert_layout: jsonb met opmaakinstellingen die de PDF-generator leest
--   (oriëntatie, logo-grootte/uitlijning/nudge, plaats bedrijfsgegevens,
--   welke gegevens tonen, accentkleur). Leeg = generator valt terug op
--   DEFAULT_CERT_LAYOUT in apps/inspector (useCertificate.ts).

alter table public.inspection_companies
  add column if not exists logo_path   text,
  add column if not exists cert_layout jsonb;

-- Publieke branding-bucket: het logo staat ook gewoon op het (publieke)
-- certificaat en de verificatiepagina, dus publiek leesbaar is prima. Alleen
-- ingelogde keurbedrijf-admins mogen uploaden/vervangen/verwijderen.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

drop policy if exists "branding insert by authenticated" on storage.objects;
drop policy if exists "branding update by authenticated" on storage.objects;
drop policy if exists "branding delete by authenticated" on storage.objects;

create policy "branding insert by authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'branding');

create policy "branding update by authenticated"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'branding')
  with check (bucket_id = 'branding');

create policy "branding delete by authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'branding');
