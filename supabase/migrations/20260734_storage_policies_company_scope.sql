-- Code review 2026-07-18, punt 5: de storage-policies uit de RLS-ronde
-- (20260713) checkten alleen "is een actieve keurmeester", niet van WELK
-- bedrijf. Gevolg: een keurmeester van bedrijf A kon bestanden van bedrijf B
-- overschrijven of verwijderen (logo, handtekening, zelfs certificaat-PDF's --
-- de paden zijn afleidbaar), en de privé-buckets (qualifications: diploma's,
-- imports: klantbestanden) van élk bedrijf lezen.
--
-- Alle app-paden beginnen consequent met het company-id als eerste map:
--   certificates:   {company_id}/{inspection_id}.pdf
--   branding:       {company_id}/logo-... en {company_id}/signatures/...
--                   plus platform/hero-... (alleen platform-admin)
--   qualifications: {company_id}/{inspector_id}/...
--   imports:        {company_id}/{timestamp}-{bestandsnaam}
--
-- Daarom hier: schrijven (en het lezen van privé-buckets) alleen binnen de
-- eigen company-map. De publieke leesrechten op certificates/branding
-- (verificatie-QR, PDF-download klant-app, logo op certificaat) blijven
-- ongewijzigd via de bestaande "public buckets read"-policy. Idempotent.

-- Hulpfunctie: is de eerste map van dit pad een keurbedrijf van de aanroeper?
create or replace function public.storage_path_in_own_company(p_name text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (storage.foldername(p_name))[1] in (
    select public.inspector_company_ids()::text
  );
$$;

grant execute on function public.storage_path_in_own_company(text) to authenticated;

-- Oude, te brede policies weg (uit 20260713_rls_enable.sql).
drop policy if exists "inspector storage select" on storage.objects;
drop policy if exists "inspector storage insert" on storage.objects;
drop policy if exists "inspector storage update" on storage.objects;
drop policy if exists "inspector storage delete" on storage.objects;

-- Lezen: keurmeesters alleen binnen de eigen company-map. (De publieke
-- buckets certificates/branding blijven daarnaast voor iedereen leesbaar via
-- de bestaande "public buckets read"-policy -- policies werken als OR.)
create policy "inspector storage select" on storage.objects
  for select to authenticated
  using (public.is_active_inspector() and public.storage_path_in_own_company(name));

-- Schrijven: keurmeesters alleen binnen de eigen company-map; de
-- platform-hero (branding/platform/...) alleen door een platform-admin.
create policy "inspector storage insert" on storage.objects
  for insert to authenticated
  with check (
    (public.is_active_inspector() and public.storage_path_in_own_company(name))
    or (bucket_id = 'branding'
        and (storage.foldername(name))[1] = 'platform'
        and public.is_platform_admin())
  );

create policy "inspector storage update" on storage.objects
  for update to authenticated
  using (
    (public.is_active_inspector() and public.storage_path_in_own_company(name))
    or (bucket_id = 'branding'
        and (storage.foldername(name))[1] = 'platform'
        and public.is_platform_admin())
  )
  with check (
    (public.is_active_inspector() and public.storage_path_in_own_company(name))
    or (bucket_id = 'branding'
        and (storage.foldername(name))[1] = 'platform'
        and public.is_platform_admin())
  );

create policy "inspector storage delete" on storage.objects
  for delete to authenticated
  using (
    (public.is_active_inspector() and public.storage_path_in_own_company(name))
    or (bucket_id = 'branding'
        and (storage.foldername(name))[1] = 'platform'
        and public.is_platform_admin())
  );
