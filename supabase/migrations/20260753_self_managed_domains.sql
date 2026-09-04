-- Kleding, machines en overig buiten het keurbedrijf houden (besluit Jos
-- 2026-08-04: "voor nu standaard self managed", plus: de keurmeester-app moet
-- niet met kleding in de keuringswizard komen te zitten).
--
-- ─── Betekenis van `self_managed` verbreed ──────────────────────────────────
-- DATAMODEL §3 beschreef `self_managed` als "zelf te keuren spullen"
-- (brandblusser, EHBO-trommel, APK). De operationele betekenis was altijd al
-- ruimer, namelijk: **dit artikel valt buiten het keurbedrijf** -- geen
-- keurmeester ziet het, de status komt niet uit `inspections`. Dat is precies
-- wat er ook voor kleding moet gelden, ook al "keurt" de klant die niet zelf.
--
-- Bewust één kolom in plaats van overal op producttype filteren: het type van
-- een artikel zit soms op `products` (via de join) en soms op
-- `articles.free_product_type`. Daarop filteren zou in elk van de vijf
-- keurmeester-queries een andere constructie opleveren -- precies het "zelfde
-- patroon op N plekken"-probleem uit CLAUDE.md. Nu is het overal
-- `.eq('self_managed', false)`.
--
-- `no_ppe` blijft er bewust BUITEN: klimsporen en voetklemmen worden volgens
-- Jos "vaak wel meegekeurd", dus die moet de keurmeester gewoon zien.

-- ─── 1. Welke types vallen buiten het keurbedrijf ───────────────────────────
-- Zelfde patroon als domain_for_type(): SQL is de autoriteit, de TypeScript-
-- kant staat in packages/core/src/domains.ts. Wijzig je er één, wijzig de ander.

create or replace function public.type_is_self_managed(p_type text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(nullif(trim(p_type), ''), 'ppe') in ('clothing', 'machine', 'other');
$$;

-- ─── 2. Bestaande artikelen bijtrekken ──────────────────────────────────────
-- Vandaag staat er nog niets op deze types (bevestigd door Jos 2026-08-04),
-- dus dit raakt naar verwachting nul rijen. Staat er toch iets, dan komt het
-- meteen goed. Idempotent: alleen zetten waar het nog niet zo is.

update public.articles a
set self_managed = true
from public.products p
where p.id = a.product_id
  and a.self_managed = false
  and public.type_is_self_managed(p.product_type);

update public.articles a
set self_managed = true
where a.product_id is null
  and a.self_managed = false
  and public.type_is_self_managed(a.free_product_type);

-- ─── 3. add_my_article zet het meteen goed ──────────────────────────────────
-- Zelfde functie als in 20260752, met alleen `self_managed` erbij. Een
-- catalogusproduct draagt zijn type zelf, dus daarvoor wordt het type uit
-- `products` gelezen in plaats van uit de parameter.

drop function if exists public.add_my_article(uuid, text, text, text, text, text, int, int, date, date);

create or replace function public.add_my_article(
  p_product_id uuid default null,
  p_free_brand text default null,
  p_free_category text default null,
  p_free_description text default null,
  p_serial_number text default null,
  p_assigned_user_name text default null,
  p_manufacture_year int default null,
  p_manufacture_month int default null,
  p_first_use_date date default null,
  p_purchase_date date default null,
  p_free_product_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer      uuid;
  v_id            uuid;
  v_type          text;
  v_effective     text;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  if p_product_id is not null then
    if not exists (select 1 from public.products p where p.id = p_product_id) then
      raise exception 'Onbekend catalogusproduct.';
    end if;
  elsif nullif(trim(coalesce(p_free_description, '')), '') is null then
    raise exception 'Kies een product uit de catalogus of vul een omschrijving in.';
  end if;

  v_type := case
    when p_product_id is not null then null
    else nullif(trim(coalesce(p_free_product_type, '')), '')
  end;
  if v_type is not null and v_type not in ('ppe', 'no_ppe', 'rigging', 'machine', 'clothing', 'other') then
    raise exception 'Onbekend producttype: %', v_type;
  end if;

  -- Het type dat écht telt: van het catalogusproduct als dat er is, anders het
  -- meegegeven vrije type.
  v_effective := coalesce(
    (select p.product_type from public.products p where p.id = p_product_id),
    v_type
  );

  insert into public.articles (
    customer_id, product_id,
    free_brand, free_category, free_description, free_product_type,
    serial_number, assigned_user_name,
    manufacture_year, manufacture_month, first_use_date, purchase_date,
    suggest_for_catalog, self_managed, source, retired
  )
  values (
    v_customer,
    p_product_id,
    case when p_product_id is null then nullif(trim(coalesce(p_free_brand, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_category, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_description, '')), '') end,
    v_type,
    nullif(trim(coalesce(p_serial_number, '')), ''),
    nullif(trim(coalesce(p_assigned_user_name, '')), ''),
    p_manufacture_year,
    p_manufacture_month,
    p_first_use_date,
    p_purchase_date,
    -- "Overig" is de eigen todo-lijst van de klant en hoort niet in de
    -- catalogus-wachtrij: daar krijg je nooit een kloppende catalogus van.
    (p_product_id is null and coalesce(v_type, '') <> 'other'),
    public.type_is_self_managed(v_effective),
    'customer',
    false
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.add_my_article(uuid, text, text, text, text, text, int, int, date, date, text) to authenticated;

-- ─── 4. update_my_article mag self_managed niet stilletjes omdraaien ────────
-- Als de klant het producttype van een vrij artikel wijzigt (bv. van 'rigging'
-- naar 'clothing'), moet self_managed meeveranderen -- anders blijft een broek
-- in de keuringswizard staan. Een trigger is hier beter dan het in elke
-- schrijfroute herhalen.

create or replace function public.sync_article_self_managed()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_effective text;
begin
  v_effective := coalesce(
    (select p.product_type from public.products p where p.id = new.product_id),
    new.free_product_type
  );
  -- Alleen aanzetten, nooit stilzwijgend uitzetten: een keurmeester of klant
  -- kan een 'other'-artikel bewust toch door een keurbedrijf willen laten
  -- keuren (machinedealers, ooit). Automatisch terugdraaien zou die keuze
  -- overschrijven.
  if public.type_is_self_managed(v_effective) then
    new.self_managed := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_article_self_managed on public.articles;
create trigger trg_article_self_managed
  before insert or update of product_id, free_product_type on public.articles
  for each row execute function public.sync_article_self_managed();
