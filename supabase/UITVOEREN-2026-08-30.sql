-- ═══════════════════════════════════════════════════════════════════════════
-- Gearonimo — alle openstaande migraties, in de juiste volgorde
-- Samengesteld op 2026-08-30
--
-- Dit bestand is een EENMALIG gemaakte samenvoeging van de losse migraties in
-- supabase/migrations/. Het bestaat om één reden: de volgorde. 20260756
-- herschrijft dezelfde databasefunctie als 20260755, dus in de verkeerde
-- volgorde draaien laat een veld stilletjes verdwijnen. Door alles in één keer
-- te plakken kan dat niet meer misgaan.
--
-- GEBRUIK: plak dit hele bestand in de Supabase SQL-editor en klik Run.
-- Alles hieronder is idempotent: nog een keer draaien kan geen kwaad.
--
-- ⚠ 20260749_catalog_reset_and_unique.sql zit hier bewust NIET bij. Dat bestand
--   koppelt elk artikel los van zijn product en maakt de catalogus leeg.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- DEEL 1 van 4: 20260755_article_detail_self_checks.sql
--
-- Zelfcontroles op het artikeldetailscherm: my_articles krijgt purchase_date,
-- my_article_detail krijgt producttype, self_managed en de zelfcontrole-velden.
-- ───────────────────────────────────────────────────────────────────────────

-- Fix na de eerste test van Jos (2026-08-04): hij voegde een EHBO-tas toe,
-- vinkte die af, en het artikeldetailscherm bleef "Nog niet gekeurd" tonen.
--
-- Oorzaak: bij het bouwen van de materiaal-tegels zijn `my_articles` (de
-- lijst) en `my_customer` uitgebreid, maar `my_article_detail` niet -- dat is
-- een eigen RPC met een eigen kolommenlijst. Het detailscherm wist dus niets
-- van producttype, self_managed of zelfcontroles.
--
-- Meteen ook `purchase_date` op `my_articles`: de statusberekening valt voor
-- "wanneer begint de termijn" terug op de aankoopdatum als er geen
-- ingebruikname-datum is. Een net gekochte EHBO-koffer zonder eerste-gebruik
-- hoorde niet meteen om aandacht te vragen.

-- ─── 1. my_articles(): purchase_date erbij ─────────────────────────────────

drop function if exists public.my_articles();

create or replace function public.my_articles()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  product_type text,
  self_managed boolean,
  serial_number text,
  assigned_user_name text,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  purchase_date date,
  first_use_date date,
  self_checked_at date,
  self_next_due date
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(p.name, a.free_description)          as name,
    coalesce(p.brand, a.free_brand)               as brand,
    coalesce(p.category, a.free_category)         as category,
    coalesce(p.product_type, a.free_product_type) as product_type,
    a.self_managed,
    a.serial_number,
    a.assigned_user_name,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    a.purchase_date,
    a.first_use_date,
    sc.checked_at        as self_checked_at,
    sc.next_due          as self_next_due
  from public.articles a
  left join public.products p on p.id = a.product_id
  left join lateral (
    select ii.result, ii.next_due, i.inspection_date
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    where ii.article_id = a.id
      and i.status = 'completed'
      and ii.result in ('passed', 'rejected')
    order by i.inspection_date desc, i.completed_at desc nulls last
    limit 1
  ) li on true
  left join lateral (
    select s.checked_at, s.next_due
    from public.self_checks s
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.retired = false
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_articles() to authenticated;

-- ─── 2. my_article_detail(): dezelfde velden als de lijst ──────────────────
-- Het rijtype wijzigt, dus eerst droppen (create or replace mag dat niet,
-- foutcode 42P13 -- zelfde reden als bij migratie 20260733).

drop function if exists public.my_article_detail(uuid);

create function public.my_article_detail(p_article_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  material text,
  category text,
  product_type text,
  self_managed boolean,
  serial_number text,
  assigned_user_name text,
  manufacture_year int,
  manufacture_month int,
  purchase_date date,
  first_use_date date,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  self_checked_at date,
  self_next_due date,
  retired boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(p.name, a.free_description)          as name,
    coalesce(p.brand, a.free_brand)               as brand,
    coalesce(p.material, a.free_material)         as material,
    coalesce(p.category, a.free_category)         as category,
    coalesce(p.product_type, a.free_product_type) as product_type,
    a.self_managed,
    a.serial_number,
    a.assigned_user_name,
    a.manufacture_year,
    a.manufacture_month,
    a.purchase_date,
    a.first_use_date,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    sc.checked_at        as self_checked_at,
    sc.next_due          as self_next_due,
    a.retired
  from public.articles a
  left join public.products p on p.id = a.product_id
  left join lateral (
    select ii.result, ii.next_due, i.inspection_date
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    where ii.article_id = a.id
      and i.status = 'completed'
      and ii.result in ('passed', 'rejected')
    order by i.inspection_date desc, i.completed_at desc nulls last
    limit 1
  ) li on true
  left join lateral (
    select s.checked_at, s.next_due
    from public.self_checks s
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.id = p_article_id
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_article_detail(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- DEEL 2 van 4: 20260756_article_detail_performed_by.sql
--
-- De naam bij een zelfcontrole. LET OP: deze herschrijft my_article_detail
-- volledig en moet dus NA 20260755 draaien, nooit ervoor.
-- ───────────────────────────────────────────────────────────────────────────

-- "Ik heb een naam ingevuld bij de controle, die hoort hier bij te staan"
-- (Jos 2026-08-04).
--
-- Klopt: add_my_self_check() slaat `performed_by` netjes op, maar
-- my_article_detail gaf alleen `checked_at` en `next_due` terug. De naam kwam
-- dus nergens uit de database vandaan.
--
-- Alleen op het detailscherm, bewust niet in de lijst: daar staat al
-- "afgevinkt op <datum>" achter serienummer en gebruiker, en er nog een naam
-- achter plakken maakt die regel op een telefoon onleesbaar.

drop function if exists public.my_article_detail(uuid);

create function public.my_article_detail(p_article_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  material text,
  category text,
  product_type text,
  self_managed boolean,
  serial_number text,
  assigned_user_name text,
  manufacture_year int,
  manufacture_month int,
  purchase_date date,
  first_use_date date,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  self_checked_at date,
  self_next_due date,
  self_performed_by text,
  self_checked_by_member text,
  retired boolean
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(p.name, a.free_description)          as name,
    coalesce(p.brand, a.free_brand)               as brand,
    coalesce(p.material, a.free_material)         as material,
    coalesce(p.category, a.free_category)         as category,
    coalesce(p.product_type, a.free_product_type) as product_type,
    a.self_managed,
    a.serial_number,
    a.assigned_user_name,
    a.manufacture_year,
    a.manufacture_month,
    a.purchase_date,
    a.first_use_date,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    sc.checked_at        as self_checked_at,
    sc.next_due          as self_next_due,
    -- Wie het volgens de invuller heeft gedaan ("Stihl-dealer Jansen",
    -- "eigen controle") -- vrije tekst, zie DATAMODEL §3.
    sc.performed_by      as self_performed_by,
    -- En wie het in de app vastlegde. Dat is iets anders: de eerste is een
    -- bewering over de buitenwereld, de tweede is het spoor in het systeem.
    sc.member_name       as self_checked_by_member,
    a.retired
  from public.articles a
  left join public.products p on p.id = a.product_id
  left join lateral (
    select ii.result, ii.next_due, i.inspection_date
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    where ii.article_id = a.id
      and i.status = 'completed'
      and ii.result in ('passed', 'rejected')
    order by i.inspection_date desc, i.completed_at desc nulls last
    limit 1
  ) li on true
  left join lateral (
    select s.checked_at, s.next_due, s.performed_by, m.name as member_name
    from public.self_checks s
    left join public.customer_members m on m.id = s.created_by_member_id
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.id = p_article_id
    and a.customer_id = (
      select m2.customer_id from public.customer_members m2
      where m2.user_id = auth.uid() and m2.active
      order by m2.created_at limit 1
    );
$$;

grant execute on function public.my_article_detail(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- DEEL 3 van 4: 20260757_products_unique_index.sql
--
-- Het slot op dubbele producten (merk + naam). Losgetrokken uit 20260749,
-- dat NIET gedraaid mag worden omdat het de catalogus leegt.
-- ───────────────────────────────────────────────────────────────────────────

-- Alleen het slot op dubbele producten — zonder de catalogus te legen.
--
-- Aanleiding (2026-07-31): `20260749_catalog_reset_and_unique.sql` doet drie
-- dingen achter elkaar: (1) alle artikelen loskoppelen van hun product,
-- (2) `delete from products`, (3) een unieke index op merk+naam. Dat was in
-- juli precies de bedoeling — de catalogus stond toen dubbel. Maar sindsdien
-- is de catalogus opnieuw geïmporteerd en heeft Jos honderden artikelen met de
-- hand aan het juiste product gekoppeld. 20260749 opnieuw draaien zou dat
-- allemaal ongedaan maken: technisch draait het foutloos ("idempotent"), maar
-- het wist wel echt werk. Draai dat bestand dus NIET meer.
--
-- Wat er nog wél moet gebeuren is deel 3: het vangnet tegen dubbelen. Dat
-- staat hieronder los, zonder de twee destructieve stappen ervoor. Veilig om
-- meerdere keren te draaien, en veilig om te draaien als 20260749 al eerder
-- volledig is uitgevoerd (dan bestaat de index al en verandert er niets).

do $$
declare
  n int;
begin
  select count(*) into n
  from (
    select 1 from public.products
    group by lower(btrim(brand)), lower(btrim(name))
    having count(*) > 1
  ) d;

  if n > 0 then
    raise notice 'Let op: nog % dubbele merk+naam-combinaties in products. Unieke index NIET aangemaakt — ruim die eerst op.', n;
  else
    create unique index if not exists products_brand_name_uniq
      on public.products (lower(btrim(brand)), lower(btrim(name)));
    raise notice 'Unieke index products_brand_name_uniq staat klaar.';
  end if;
end $$;

-- Controle achteraf (los te draaien):
--   select count(*) as producten from public.products;
--   select count(*) as gekoppelde_artikelen from public.articles where product_id is not null;
--   select indexname from pg_indexes
--    where tablename = 'products' and indexname = 'products_brand_name_uniq';


-- ───────────────────────────────────────────────────────────────────────────
-- DEEL 4 van 4: 20260748_platform_admin_set_password.sql
--
-- Platformbeheerder kan een wachtwoord instellen voor een keurmeester.
-- Alleen nodig voor fase 7 van het testplan.
-- ───────────────────────────────────────────────────────────────────────────

-- Platform-admin kan een wachtwoord instellen voor een keurmeester (besluit
-- Jos 2026-07-21).
--
-- Aanleiding: de uitnodigingsmail (magic-link) komt lang niet altijd aan --
-- vooral Microsoft-365-postbussen houden 'm stil tegen (quarantaine, geen
-- bounce, niet in spam). Zoho levert 'm netjes af, maar de ontvangende kant
-- gooit 'm weg. Voor die gevallen wil Jos een keurmeester gewoon zelf een
-- (start)wachtwoord kunnen geven, zodat diegene direct met e-mail+wachtwoord
-- in de keurder-app kan (die login bestond al), zonder mail.
--
-- LET OP -- dit schrijft in `auth.users`, de interne auth-tabel van Supabase.
-- Dat is bewust en volgt het gangbare Supabase-patroon (bcrypt-hash via
-- pgcrypto). De account-rij moet al bestaan: het uitnodigen ("Uitnodigen en
-- koppelen") maakt die rij al aan via signInWithOtp, óók als de mail nooit
-- aankomt. We zetten hier alleen het wachtwoord + bevestigen het e-mailadres
-- (email_confirmed_at) zodat inloggen lukt ook als "Confirm email" aanstaat.
-- Test dit na het uitvoeren op één account (instellen -> uitloggen -> inloggen
-- met e-mail+wachtwoord) voordat je erop vertrouwt.
--
-- Beveiliging: security-definer + expliciete is_platform_admin()-check, zelfde
-- patroon als de andere platform_admin_*-RPC's (20260740). search_path leeg +
-- alles volledig gekwalificeerd, zodat niets via een gekaapt pad omgeleid kan
-- worden.

-- pgcrypto levert crypt()/gen_salt(); op Supabase in het schema `extensions`.
create extension if not exists pgcrypto with schema extensions;

create or replace function public.platform_admin_set_inspector_password(
  p_inspector_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag een wachtwoord instellen.';
  end if;

  if p_password is null or length(p_password) < 8 then
    raise exception 'Wachtwoord moet minstens 8 tekens zijn.';
  end if;

  select user_id into v_user_id from public.inspectors where id = p_inspector_id;
  if v_user_id is null then
    raise exception 'Deze keurmeester heeft nog geen account. Nodig ze eerst uit via e-mail (dat maakt het account aan).';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
  where id = v_user_id;
end;
$$;

grant execute on function public.platform_admin_set_inspector_password(uuid, text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- KLAAR. Draai hierna de controlequery uit MIGRATIES-UITVOEREN.md (stap 7).
-- ═══════════════════════════════════════════════════════════════════════════
