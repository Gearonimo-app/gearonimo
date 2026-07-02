-- NOODREM voor de RLS-ronde (20260713_rls_enable.sql). GEEN migratie --
-- alleen uitvoeren als de apps na de RLS-migratie ergens onverwacht op
-- blokkeren en er geen tijd is om het netjes te fixen (bv. midden op een
-- keurdag). Zet RLS uit (policies blijven bestaan maar doen niets) en
-- herstelt de ruime bouwfase-storage-policies. Daarna: melden bij Claude,
-- oorzaak fixen, en de RLS-migratie opnieuw draaien.

alter table public.customers disable row level security;
alter table public.customer_links disable row level security;
alter table public.customer_members disable row level security;
alter table public.articles disable row level security;
alter table public.article_sets disable row level security;
alter table public.article_set_members disable row level security;
alter table public.inspections disable row level security;
alter table public.inspection_items disable row level security;
alter table public.certificates disable row level security;
alter table public.rejection_codes disable row level security;
alter table public.inspection_companies disable row level security;
alter table public.inspectors disable row level security;
alter table public.inspector_qualifications disable row level security;
alter table public.offline_downloads disable row level security;
alter table public.import_batches disable row level security;
alter table public.import_profiles disable row level security;
alter table public.products disable row level security;
alter table public.article_notes disable row level security;
alter table public.photos disable row level security;
alter table public.platform_admins disable row level security;
alter table public.product_versions disable row level security;
alter table public.self_checks disable row level security;
alter table public.usage_counters disable row level security;
alter table public.users disable row level security;
alter table public.inspection_requests disable row level security;
alter table public.inspection_regimes disable row level security;

-- Storage terug naar de ruime bouwfase-policies.
drop policy if exists "inspector storage select" on storage.objects;
drop policy if exists "inspector storage insert" on storage.objects;
drop policy if exists "inspector storage update" on storage.objects;
drop policy if exists "inspector storage delete" on storage.objects;
drop policy if exists "public buckets read" on storage.objects;

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
