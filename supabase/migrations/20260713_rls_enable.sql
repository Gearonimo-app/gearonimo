-- Slice 3.2: RLS-ronde (BOUWPLAN fase 3). Gebaseerd op de live schema-dump
-- van Jos (2026-07-02), niet op aannames -- de dump bracht ook drie losse
-- gebreken boven water die hier meteen worden rechtgezet (zie A).
--
-- Vertrouwensmodel na deze migratie:
-- - Keurmeesters (actieve inspectors-rij) zien en bewerken alles van hun
--   eigen keurbedrijf; klanten zijn bereikbaar via customer_links.
-- - Klant-accounts (customer_members.user_id) hebben GEEN directe
--   tabel-toegang: alles loopt via de bestaande security-definer-RPC's
--   (my_customer/my_articles/my_certificates/join_customer_by_invite/
--   retire_my_article) -- die negeren RLS bewust en scopen zelf op
--   auth.uid().
-- - anon: niets, behalve de publieke storage-buckets (certificaten/logo's)
--   en de verify_certificate-RPC.
-- - De catalogus (products) blijft leesbaar voor alle ingelogden.

-- ─── A. Losse gebreken uit de schema-diff ────────────────────────────────

-- A1. customer_members.user_id stond live op NOT NULL (de repo-migratie
--     declareerde nullable, maar de kolom bestond al). Daardoor faalt
--     "Medewerker toevoegen" in de inspector-app op dit moment stil: de
--     keurmeester voert medewerkers zonder account in.
alter table public.customer_members
  alter column user_id drop not null;

-- A2. articles miste een DELETE-grant: het hard verwijderen van een nooit
--     gekeurd artikel (prullenbak in de wizard/artikeldetail) faalde stil.
grant delete on public.articles to authenticated;

-- A3. certificates miste een DELETE-grant: hergenereren van een certificaat
--     doet eerst een (stil falende) delete van het oude record.
grant delete on public.certificates to authenticated;

-- ─── B. Hulpfuncties (security definer: policies mogen niet op zichzelf
--        recursen en klant-RPC's blijven buiten RLS om werken) ───────────

create or replace function public.is_active_inspector()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.inspectors i
    where i.user_id = auth.uid() and i.active
  );
$$;

create or replace function public.inspector_company_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select i.company_id from public.inspectors i
  where i.user_id = auth.uid() and i.active;
$$;

create or replace function public.inspector_customer_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select cl.customer_id
  from public.customer_links cl
  join public.inspectors i on i.company_id = cl.company_id
  where i.user_id = auth.uid() and i.active;
$$;

grant execute on function public.is_active_inspector() to authenticated;
grant execute on function public.inspector_company_ids() to authenticated;
grant execute on function public.inspector_customer_ids() to authenticated;

-- ─── C. Gevaarlijke brede rechten intrekken ──────────────────────────────
-- TRUNCATE valt NIET onder RLS en stond aan voor iedereen; REFERENCES en
-- TRIGGER horen ook niet bij app-rollen. anon had verder toch niets.

revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

-- ─── D. RLS aan + policies per tabel ─────────────────────────────────────

-- customers ---------------------------------------------------------------
alter table public.customers enable row level security;
drop policy if exists "temp allow all authenticated" on public.customers;
drop policy if exists "customers inspector read write" on public.customers;
drop policy if exists "customers inspector insert" on public.customers;
create policy "customers inspector read write" on public.customers
  for all to authenticated
  using (id in (select public.inspector_customer_ids()))
  with check (id in (select public.inspector_customer_ids()));
-- Een NIEUWE klant heeft nog geen customer_links-rij (de trigger
-- link_new_customer_to_company maakt die pas ná de insert aan), dus de
-- insert-check is alleen "is een actieve keurmeester".
create policy "customers inspector insert" on public.customers
  for insert to authenticated
  with check (public.is_active_inspector());

-- customer_links ----------------------------------------------------------
alter table public.customer_links enable row level security;
drop policy if exists "customer_links inspector all" on public.customer_links;
create policy "customer_links inspector all" on public.customer_links
  for all to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));

-- customer_members ---------------------------------------------------------
alter table public.customer_members enable row level security;
drop policy if exists "customer_members inspector all" on public.customer_members;
create policy "customer_members inspector all" on public.customer_members
  for all to authenticated
  using (customer_id in (select public.inspector_customer_ids()))
  with check (customer_id in (select public.inspector_customer_ids()));

-- articles ------------------------------------------------------------------
alter table public.articles enable row level security;
drop policy if exists "articles inspector all" on public.articles;
create policy "articles inspector all" on public.articles
  for all to authenticated
  using (customer_id in (select public.inspector_customer_ids()))
  with check (customer_id in (select public.inspector_customer_ids()));

-- article_sets / article_set_members ---------------------------------------
alter table public.article_sets enable row level security;
drop policy if exists "article_sets inspector all" on public.article_sets;
create policy "article_sets inspector all" on public.article_sets
  for all to authenticated
  using (customer_id in (select public.inspector_customer_ids()))
  with check (customer_id in (select public.inspector_customer_ids()));

alter table public.article_set_members enable row level security;
drop policy if exists "article_set_members inspector all" on public.article_set_members;
create policy "article_set_members inspector all" on public.article_set_members
  for all to authenticated
  using (exists (
    select 1 from public.article_sets s
    where s.id = set_id
      and s.customer_id in (select public.inspector_customer_ids())
  ))
  with check (exists (
    select 1 from public.article_sets s
    where s.id = set_id
      and s.customer_id in (select public.inspector_customer_ids())
  ));

-- inspections / inspection_items -------------------------------------------
alter table public.inspections enable row level security;
drop policy if exists "inspections inspector all" on public.inspections;
create policy "inspections inspector all" on public.inspections
  for all to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));

alter table public.inspection_items enable row level security;
drop policy if exists "inspection_items inspector all" on public.inspection_items;
create policy "inspection_items inspector all" on public.inspection_items
  for all to authenticated
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and i.company_id in (select public.inspector_company_ids())
  ))
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and i.company_id in (select public.inspector_company_ids())
  ));

-- certificates ---------------------------------------------------------------
alter table public.certificates enable row level security;
drop policy if exists "certificates inspector all" on public.certificates;
create policy "certificates inspector all" on public.certificates
  for all to authenticated
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and i.company_id in (select public.inspector_company_ids())
  ))
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id
      and i.company_id in (select public.inspector_company_ids())
  ));

-- rejection_codes -------------------------------------------------------------
-- Lezen: eigen bedrijf + de platformstandaard (company_id is null).
-- Schrijven: alleen eigen bedrijf.
alter table public.rejection_codes enable row level security;
drop policy if exists "rejection_codes inspector read" on public.rejection_codes;
drop policy if exists "rejection_codes inspector insert" on public.rejection_codes;
drop policy if exists "rejection_codes inspector update" on public.rejection_codes;
drop policy if exists "rejection_codes inspector delete" on public.rejection_codes;
create policy "rejection_codes inspector read" on public.rejection_codes
  for select to authenticated
  using (company_id is null or company_id in (select public.inspector_company_ids()));
create policy "rejection_codes inspector insert" on public.rejection_codes
  for insert to authenticated
  with check (company_id in (select public.inspector_company_ids()));
create policy "rejection_codes inspector update" on public.rejection_codes
  for update to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));
create policy "rejection_codes inspector delete" on public.rejection_codes
  for delete to authenticated
  using (company_id in (select public.inspector_company_ids()));

-- inspection_companies ---------------------------------------------------------
alter table public.inspection_companies enable row level security;
drop policy if exists "inspection_companies inspector read" on public.inspection_companies;
drop policy if exists "inspection_companies inspector update" on public.inspection_companies;
create policy "inspection_companies inspector read" on public.inspection_companies
  for select to authenticated
  using (id in (select public.inspector_company_ids()));
create policy "inspection_companies inspector update" on public.inspection_companies
  for update to authenticated
  using (id in (select public.inspector_company_ids()))
  with check (id in (select public.inspector_company_ids()));

-- inspectors + kwalificaties ----------------------------------------------------
alter table public.inspectors enable row level security;
drop policy if exists "inspectors read own company" on public.inspectors;
drop policy if exists "inspectors insert own company" on public.inspectors;
drop policy if exists "inspectors update own company" on public.inspectors;
drop policy if exists "inspectors delete accountless" on public.inspectors;
create policy "inspectors read own company" on public.inspectors
  for select to authenticated
  using (user_id = auth.uid() or company_id in (select public.inspector_company_ids()));
create policy "inspectors insert own company" on public.inspectors
  for insert to authenticated
  with check (company_id in (select public.inspector_company_ids()));
create policy "inspectors update own company" on public.inspectors
  for update to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));
-- Verwijderen kan alleen bij account-loze registraties (zoals het
-- beheerscherm al doet); een keurmeester mét account gaat op inactief.
create policy "inspectors delete accountless" on public.inspectors
  for delete to authenticated
  using (company_id in (select public.inspector_company_ids()) and user_id is null);

alter table public.inspector_qualifications enable row level security;
drop policy if exists "inspector_qualifications inspector all" on public.inspector_qualifications;
create policy "inspector_qualifications inspector all" on public.inspector_qualifications
  for all to authenticated
  using (exists (
    select 1 from public.inspectors i
    where i.id = inspector_id
      and i.company_id in (select public.inspector_company_ids())
  ))
  with check (exists (
    select 1 from public.inspectors i
    where i.id = inspector_id
      and i.company_id in (select public.inspector_company_ids())
  ));

-- offline_downloads (watermerk-logboek) -----------------------------------------
alter table public.offline_downloads enable row level security;
drop policy if exists "offline_downloads inspector read" on public.offline_downloads;
drop policy if exists "offline_downloads inspector insert" on public.offline_downloads;
create policy "offline_downloads inspector read" on public.offline_downloads
  for select to authenticated
  using (company_id in (select public.inspector_company_ids()));
create policy "offline_downloads inspector insert" on public.offline_downloads
  for insert to authenticated
  with check (company_id in (select public.inspector_company_ids()));

-- import_batches / import_profiles -----------------------------------------------
alter table public.import_batches enable row level security;
drop policy if exists "import_batches inspector all" on public.import_batches;
create policy "import_batches inspector all" on public.import_batches
  for all to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));

alter table public.import_profiles enable row level security;
drop policy if exists "import_profiles inspector all" on public.import_profiles;
create policy "import_profiles inspector all" on public.import_profiles
  for all to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));

-- products (catalogus): leesbaar voor alle ingelogden, schrijven voor niemand
-- rechtstreeks (curator-flow komt later; er bestond ook alleen een SELECT-grant).
alter table public.products enable row level security;
drop policy if exists "authenticated can read products" on public.products;
create policy "authenticated can read products" on public.products
  for select to authenticated using (true);

-- Tabellen zonder app-gebruik: RLS aan, geen policies = volledig op slot.
alter table public.article_notes enable row level security;
alter table public.photos enable row level security;
alter table public.platform_admins enable row level security;
alter table public.product_versions enable row level security;
alter table public.self_checks enable row level security;
alter table public.usage_counters enable row level security;
alter table public.users enable row level security;
alter table public.inspection_requests enable row level security;
alter table public.inspection_regimes enable row level security;

-- ─── E. ensure_inspector: geen auto-provisioning meer ────────────────────
-- De oude versie maakte voor elk nieuw account een keurmeester-rij aan. Met
-- een publieke klant-login is dat onhoudbaar: iedereen die zich via de
-- magic-link registreert zou keurmeester worden. Bestaande keurmeesters
-- blijven gewoon werken; nieuwe komen er via het beheerscherm (Instellingen
-- -> Keurmeesters), een echte uitnodigingsflow staat in het bouwplan.
create or replace function public.ensure_inspector()
returns public.inspectors
language plpgsql
security definer
set search_path = public
as $function$
declare
  result public.inspectors;
begin
  select * into result from public.inspectors
  where user_id = auth.uid() and active;
  if result.id is null then
    raise exception 'Dit account is geen keurmeester-account. Vraag je beheerder om toegang.';
  end if;
  return result;
end;
$function$;

-- ─── F. Storage: schrijven alleen voor keurmeesters ──────────────────────
-- De bouwfase-policies ("build authenticated ...") gaven elke ingelogde --
-- dus ook klant-accounts -- schrijfrechten op alle buckets, inclusief het
-- overschrijven van certificaat-PDF's (pad is afleidbaar uit
-- my_certificates). Nu: lezen + schrijven voor keurmeesters; publiek lezen
-- van certificaten/logo's blijft (verificatie-QR, PDF-download klant-app).
drop policy if exists "build authenticated select" on storage.objects;
drop policy if exists "build authenticated insert" on storage.objects;
drop policy if exists "build authenticated update" on storage.objects;
drop policy if exists "build authenticated delete" on storage.objects;
drop policy if exists "build public read" on storage.objects;
drop policy if exists "certificates upload by authenticated" on storage.objects;
drop policy if exists "certificates update by authenticated" on storage.objects;
drop policy if exists "inspector storage select" on storage.objects;
drop policy if exists "inspector storage insert" on storage.objects;
drop policy if exists "inspector storage update" on storage.objects;
drop policy if exists "inspector storage delete" on storage.objects;
drop policy if exists "public buckets read" on storage.objects;

create policy "inspector storage select" on storage.objects
  for select to authenticated using (public.is_active_inspector());
create policy "inspector storage insert" on storage.objects
  for insert to authenticated with check (public.is_active_inspector());
create policy "inspector storage update" on storage.objects
  for update to authenticated
  using (public.is_active_inspector())
  with check (public.is_active_inspector());
create policy "inspector storage delete" on storage.objects
  for delete to authenticated using (public.is_active_inspector());

-- Publieke buckets (certificaat-verificatie, bedrijfslogo/handtekening op
-- het certificaat) leesbaar voor iedereen, ook zonder account.
create policy "public buckets read" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('certificates', 'branding'));
