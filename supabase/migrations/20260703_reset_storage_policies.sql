-- Tijdens een live test faalde "Afronden" van een keuring op het uploaden van
-- het certificaat-PDF: storage gaf 403 "new row violates row-level security
-- policy". De per-bucket policies bestonden wél in eerdere migraties, maar op de
-- live database stonden daarnaast oude/handmatig (via het dashboard) aangemaakte
-- policies op storage.objects die de upload blokkeerden. Een gerichte
-- "drop policy if exists <naam>" ruimt die niet op, want ze hadden andere namen.
--
-- Daarom: ruim ALLE policies op storage.objects op en zet er schone,
-- toestemmende bouwfase-policies neer. Ingelogde keurders mogen alle
-- bestandsacties; publieke buckets (certificaat-verificatie + bedrijfslogo)
-- blijven ook zonder account leesbaar; privébuckets (imports, qualifications)
-- blijven alleen voor ingelogde gebruikers.
--
-- LET OP (bouwfase): dit is bewust ruim, passend bij "RLS uit tijdens de bouw,
-- één keurbedrijf" (BOUWPLAN 2026-06-26). Vóór er echte klanten/andere
-- keurbedrijven bijkomen moeten deze policies in de geplande beveiligingsronde
-- (fase 4) per bucket worden aangescherpt.

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy "build authenticated select" on storage.objects
  for select to authenticated using (true);
create policy "build authenticated insert" on storage.objects
  for insert to authenticated with check (true);
create policy "build authenticated update" on storage.objects
  for update to authenticated using (true) with check (true);
create policy "build authenticated delete" on storage.objects
  for delete to authenticated using (true);

create policy "build public read" on storage.objects
  for select to anon using (bucket_id in ('certificates', 'branding'));
