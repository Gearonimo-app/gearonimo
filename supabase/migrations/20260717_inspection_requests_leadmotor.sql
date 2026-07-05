-- Fase 3, laatste stuk: keuring aanvragen / de leadmotor (BLAUWDRUK §7,
-- DATAMODEL §5 inspection_requests). Besloten met Jos 2026-07-05:
--
-- * Gearonimo is PUUR het platform/de matchmaker -- GEEN keurbedrijf-rij die
--   klanten "bezit" (dat zou het platform tot concurrent van zijn eigen
--   keurbedrijven maken). Een zelf-aangemelde klant staat daarom OP ZICHZELF,
--   zonder koppeling, tot hij zelf een keurbedrijf kiest.
-- * Ontdekking = wereldkaart met alle keurbedrijven die "open voor nieuwe
--   klanten" (listed) aan hebben staan + naam-zoeken. GEEN landfilter: een
--   NL-bedrijf mag Belgische klanten, buitenlanders in NL moeten hier terecht
--   kunnen (Jos). De klant kiest zelf op de kaart.
-- * Aanvraag via inspection_requests; de keurmeester keurt goed/af in de
--   Pro-app. Bij "accepted" wordt de koppeling actief en worden andere actieve
--   koppelingen van die klant beeindigd (overstap, een keurbedrijf tegelijk).
-- * De klant is eigenaar van de data: het actueel gekoppelde keurbedrijf mag
--   de VOLLEDIGE keuringshistorie van de klant inzien (alleen-lezen), ook
--   keuringen die een vorig keurbedrijf uitvoerde -- zo reist de historie mee.
--
-- Alles idempotent. RLS blijft aan (sinds 20260713); klant-toegang loopt via
-- security-definer-RPC's, keurmeester-toegang via het bestaande company-scope.

-- ─── 1. inspection_companies: lijst-schakelaar + locatie voor de kaart ───────
alter table public.inspection_companies
  add column if not exists listed    boolean not null default false;
alter table public.inspection_companies
  add column if not exists latitude  double precision;
alter table public.inspection_companies
  add column if not exists longitude double precision;

comment on column public.inspection_companies.listed is
  'Schakelaar "open voor nieuwe klanten": alleen dan verschijnt het bedrijf op '
  'de openbare kaart. Naam-zoeken vindt ook niet-gelijste bedrijven.';

-- Het bestaande (oudste) keurbedrijf -- Safety Green -- meteen vindbaar zetten
-- zodat het aanvraagpad te testen is, met de coordinaten van Elst (Gld). Alleen
-- bij de eerste toepassing (coordinaten nog leeg), zodat een latere handmatige
-- wijziging/uitschakeling niet teruggedraaid wordt bij opnieuw draaien.
update public.inspection_companies
set listed = true, latitude = 51.9231, longitude = 5.8447
where id = (select id from public.inspection_companies order by created_at limit 1)
  and latitude is null;

-- ─── 2. inspection_requests (DATAMODEL §5) ──────────────────────────────────
create table if not exists public.inspection_requests (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id) on delete cascade,
  company_id   uuid not null references public.inspection_companies(id) on delete cascade,
  source       text not null default 'name_search'
                 check (source in ('public_list', 'invite_code', 'name_search', 'switch')),
  message      text,
  status       text not null default 'pending'
                 check (status in ('pending', 'accepted', 'declined', 'withdrawn')),
  requested_by uuid references auth.users(id),
  handled_by   uuid references auth.users(id),
  handled_at   timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists inspection_requests_company_pending_idx
  on public.inspection_requests(company_id) where status = 'pending';
create index if not exists inspection_requests_customer_idx
  on public.inspection_requests(customer_id);

-- Hoogstens een openstaande aanvraag per klant+bedrijf (dubbelklik-vangnet).
create unique index if not exists inspection_requests_one_pending
  on public.inspection_requests(customer_id, company_id) where status = 'pending';

alter table public.inspection_requests enable row level security;

-- Keurmeester mag de aanvragen van zijn eigen bedrijf lezen (schrijven gaat via
-- de definer-RPC's hieronder). Klant-toegang loopt volledig via RPC.
drop policy if exists "inspection_requests inspector read" on public.inspection_requests;
create policy "inspection_requests inspector read" on public.inspection_requests
  for select to authenticated
  using (company_id in (select public.inspector_company_ids()));

grant select on public.inspection_requests to authenticated;

-- ─── 3. Auto-koppel-trigger herzien ─────────────────────────────────────────
-- De oude trigger koppelde ELKE nieuwe klant aan "het oudste bedrijf" -- een
-- tijdelijke hack uit de een-bedrijf-fase (zie 20260624_customer_links.sql).
-- Nu: koppel aan het bedrijf van de KEURMEESTER die de klant aanmaakt. Wordt de
-- klant niet door een keurmeester aangemaakt (zelf-aanmelden via de klant-app),
-- dan GEEN automatische koppeling -- die klant staat op zichzelf tot hij zelf
-- een keurbedrijf kiest.
create or replace function public.link_new_customer_to_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_company uuid;
begin
  select i.company_id into v_company
  from public.inspectors i
  where i.user_id = auth.uid() and i.active
  order by i.created_at
  limit 1;

  if v_company is not null then
    insert into public.customer_links (customer_id, company_id, status)
    values (new.id, v_company, 'active')
    on conflict (customer_id, company_id) do nothing;
  end if;
  return new;
end;
$function$;

-- ─── 4. Zelf-aanmelden (klant-app): eigen klant zonder keurbedrijf ──────────
create or replace function public.self_register_customer(p_name text)
returns table (customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_email    text := coalesce(auth.jwt() ->> 'email', '');
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd.';
  end if;
  if exists (select 1 from public.customer_members m where m.user_id = auth.uid() and m.active) then
    raise exception 'Dit account is al aan een klant gekoppeld.';
  end if;

  -- email meteen meegeven: het is het contactadres van de klant, en dekt een
  -- eventuele NOT NULL-constraint op customers.email in het live-schema af.
  insert into public.customers (name, email)
  values (coalesce(nullif(trim(p_name), ''), 'Mijn materiaal'), nullif(v_email, ''))
  returning * into v_customer;

  -- De trigger koppelt niets (aanroeper is geen keurmeester): de klant staat
  -- bewust op zichzelf tot hij zelf een keurbedrijf aanvraagt.
  insert into public.customer_members (customer_id, user_id, name, email, active, is_admin)
  values (
    v_customer.id,
    auth.uid(),
    coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1), 'Ik'),
    nullif(v_email, ''),
    true,
    true
  );

  return query select v_customer.id, v_customer.name;
end;
$$;

-- ─── 5. Ontdekking: openbare kaart + naam-zoeken (klant-app) ─────────────────
create or replace function public.list_inspection_companies()
returns table (
  id uuid, name text, city text, country_code text,
  address text, postal_code text,
  latitude double precision, longitude double precision
)
language sql
security definer
set search_path = public
as $$
  select id, name, city, country_code, address, postal_code, latitude, longitude
  from public.inspection_companies
  where listed = true
  order by name;
$$;

-- Naam-zoeken vindt bewust OOK niet-gelijste bedrijven (BLAUWDRUK §7.3: wie een
-- bedrijf bij naam kent is geen lead van een ander).
create or replace function public.search_inspection_companies(p_query text)
returns table (
  id uuid, name text, city text, country_code text,
  latitude double precision, longitude double precision
)
language sql
security definer
set search_path = public
as $$
  select id, name, city, country_code, latitude, longitude
  from public.inspection_companies
  where length(trim(coalesce(p_query, ''))) >= 2
    and name ilike '%' || trim(p_query) || '%'
  order by name
  limit 25;
$$;

-- ─── 6. Aanvragen (klant-app) ────────────────────────────────────────────────
create or replace function public.request_inspection(
  p_company_id uuid, p_source text default 'name_search', p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_req      uuid;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active and m.is_admin
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Alleen een beheerder van een klant kan een keuring aanvragen.';
  end if;
  if not exists (select 1 from public.inspection_companies where id = p_company_id) then
    raise exception 'Onbekend keurbedrijf.';
  end if;

  -- Al een openstaande aanvraag bij dit bedrijf? Die teruggeven i.p.v. dubbel.
  select id into v_req from public.inspection_requests
  where customer_id = v_customer and company_id = p_company_id and status = 'pending';
  if v_req is not null then
    return v_req;
  end if;

  insert into public.inspection_requests (customer_id, company_id, source, message, requested_by, status)
  values (
    v_customer,
    p_company_id,
    case when p_source in ('public_list', 'invite_code', 'name_search', 'switch') then p_source else 'name_search' end,
    nullif(trim(p_message), ''),
    auth.uid(),
    'pending'
  )
  returning id into v_req;
  return v_req;
end;
$$;

create or replace function public.my_inspection_requests()
returns table (
  id uuid, company_id uuid, company_name text, city text,
  status text, source text, created_at timestamptz, handled_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.company_id, c.name, c.city, r.status, r.source, r.created_at, r.handled_at
  from public.inspection_requests r
  join public.inspection_companies c on c.id = r.company_id
  where r.customer_id in (
    select m.customer_id from public.customer_members m
    where m.user_id = auth.uid() and m.active
  )
  order by r.created_at desc;
$$;

create or replace function public.withdraw_inspection_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inspection_requests r
  set status = 'withdrawn', handled_at = now()
  where r.id = p_request_id
    and r.status = 'pending'
    and r.customer_id in (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active and m.is_admin
    );
end;
$$;

-- ─── 7. Behandelen (Pro-app: keurmeester) ────────────────────────────────────
create or replace function public.company_inspection_requests()
returns table (
  id uuid, customer_id uuid, customer_name text,
  source text, message text, created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.customer_id, cu.name, r.source, r.message, r.created_at
  from public.inspection_requests r
  join public.customers cu on cu.id = r.customer_id
  where r.company_id in (select public.inspector_company_ids())
    and r.status = 'pending'
  order by r.created_at;
$$;

-- Goedkeuren: koppeling actief, andere actieve koppelingen van de klant
-- beeindigd (overstap). on conflict heractiveert een eerder beeindigde link.
create or replace function public.accept_inspection_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.inspection_requests%rowtype;
begin
  select * into v_req
  from public.inspection_requests r
  where r.id = p_request_id
    and r.status = 'pending'
    and r.company_id in (select public.inspector_company_ids());
  if not found then
    raise exception 'Aanvraag niet gevonden of niet van jouw keurbedrijf.';
  end if;

  update public.customer_links cl
  set status = 'ended', ended_at = now()
  where cl.customer_id = v_req.customer_id
    and cl.status = 'active'
    and cl.company_id <> v_req.company_id;

  insert into public.customer_links (customer_id, company_id, status)
  values (v_req.customer_id, v_req.company_id, 'active')
  on conflict (customer_id, company_id)
  do update set status = 'active', ended_at = null;

  update public.inspection_requests r
  set status = 'accepted', handled_at = now(), handled_by = auth.uid()
  where r.id = p_request_id;
end;
$$;

create or replace function public.decline_inspection_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inspection_requests r
  set status = 'declined', handled_at = now(), handled_by = auth.uid()
  where r.id = p_request_id
    and r.status = 'pending'
    and r.company_id in (select public.inspector_company_ids());
end;
$$;

-- Keurmeester mag zijn eigen bedrijf op de kaart zetten (listed + locatie).
create or replace function public.set_company_listing(
  p_listed boolean, p_latitude double precision default null, p_longitude double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.inspection_companies c
  set listed = p_listed,
      latitude = coalesce(p_latitude, c.latitude),
      longitude = coalesce(p_longitude, c.longitude)
  where c.id in (select public.inspector_company_ids());
end;
$$;

-- Keurmeester leest de eigen lijst-instellingen (voor het instellingenscherm).
create or replace function public.my_company_listing()
returns table (listed boolean, latitude double precision, longitude double precision, city text, address text)
language sql
security definer
set search_path = public
as $$
  select c.listed, c.latitude, c.longitude, c.city, c.address
  from public.inspection_companies c
  where c.id in (select public.inspector_company_ids())
  limit 1;
$$;

-- Mijn actieve keurbedrijf (klant-app: standalone tonen + "ander keurbedrijf").
create or replace function public.my_link_status()
returns table (company_id uuid, company_name text)
language sql
security definer
set search_path = public
as $$
  select ic.id, ic.name
  from public.customer_members m
  join public.customer_links cl on cl.customer_id = m.customer_id and cl.status = 'active'
  join public.inspection_companies ic on ic.id = cl.company_id
  where m.user_id = auth.uid() and m.active
  order by cl.started_at desc
  limit 1;
$$;

grant execute on function public.self_register_customer(text) to authenticated;
grant execute on function public.my_link_status() to authenticated;
grant execute on function public.list_inspection_companies() to authenticated;
grant execute on function public.search_inspection_companies(text) to authenticated;
grant execute on function public.request_inspection(uuid, text, text) to authenticated;
grant execute on function public.my_inspection_requests() to authenticated;
grant execute on function public.withdraw_inspection_request(uuid) to authenticated;
grant execute on function public.company_inspection_requests() to authenticated;
grant execute on function public.accept_inspection_request(uuid) to authenticated;
grant execute on function public.decline_inspection_request(uuid) to authenticated;
grant execute on function public.set_company_listing(boolean, double precision, double precision) to authenticated;
grant execute on function public.my_company_listing() to authenticated;

-- ─── 8. Historie reist mee met de klant ─────────────────────────────────────
-- Extra ALLEEN-LEZEN policies: het actueel (actief) gekoppelde keurbedrijf mag
-- de volledige keuringshistorie/certificaten van die klant inzien, ook wat een
-- vorig keurbedrijf uitvoerde. Bewerken blijft van het uitvoerende bedrijf (de
-- bestaande "for all"-policies op company_id); afgeronde keuringen zijn sowieso
-- onveranderlijk. Policies combineren met OR, dus dit verruimt alleen SELECT.
drop policy if exists "inspections linked read" on public.inspections;
create policy "inspections linked read" on public.inspections
  for select to authenticated
  using (customer_id in (select public.inspector_customer_ids()));

drop policy if exists "inspection_items linked read" on public.inspection_items;
create policy "inspection_items linked read" on public.inspection_items
  for select to authenticated
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_items.inspection_id
      and i.customer_id in (select public.inspector_customer_ids())
  ));

drop policy if exists "certificates linked read" on public.certificates;
create policy "certificates linked read" on public.certificates
  for select to authenticated
  using (exists (
    select 1 from public.inspections i
    where i.id = certificates.inspection_id
      and i.customer_id in (select public.inspector_customer_ids())
  ));
