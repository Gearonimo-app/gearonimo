-- Fase 3, slice 3.3: klantbedrijf-admin in de klant-app (BOUWPLAN fase 3).
-- Medewerkers beheren + zelf artikelen toevoegen, allebei via security
-- definer-RPC's: klant-accounts hebben sinds de RLS-ronde (20260713) geen
-- directe tabel-toegang, en dat blijft zo.
--
-- Beheerrechten: DATAMODEL §customer_members schetste role='manager'/'end_user',
-- maar `role` is in de implementatie al vrije tekst (functie, bv.
-- "magazijnbeheerder"). Daarom hier -- zelfde patroon als inspectors.is_admin --
-- een losse boolean `is_admin`: bepaalt alleen beheeracties (medewerkers),
-- niet de zichtbaarheid van materiaal (die is en blijft per customer_id).

-- ─── 1. is_admin op customer_members ────────────────────────────────────────

alter table public.customer_members
  add column if not exists is_admin boolean not null default false;

-- Backfill: per klantbedrijf wordt het oudste actieve lid MET account
-- beheerder, zodat bestaande koppelingen (Jos' testaccounts) meteen bij de
-- medewerkers kunnen. Klanten zonder gekoppeld account krijgen hun beheerder
-- straks automatisch bij de eerste join (zie join_customer_by_invite).
update public.customer_members m
set is_admin = true
where m.user_id is not null
  and m.active
  and not exists (
    select 1 from public.customer_members a
    where a.customer_id = m.customer_id and a.is_admin
  )
  and m.id = (
    select m2.id from public.customer_members m2
    where m2.customer_id = m.customer_id and m2.user_id is not null and m2.active
    order by m2.created_at
    limit 1
  );

-- ─── 2. Eerste account dat koppelt wordt beheerder ──────────────────────────
-- Zelfde functie als 20260708, plus: heeft dit klantbedrijf nog geen enkele
-- beheerder, dan wordt het koppelende account het (de contactpersoon die de
-- uitnodigingscode van de keurmeester kreeg). Latere collega's koppelen als
-- gewone medewerker; de beheerder (of de keurmeester) kan ze promoveren.

create or replace function public.join_customer_by_invite(p_code text, p_name text default null)
returns table (customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_email    text := coalesce(auth.jwt() ->> 'email', '');
  v_member   uuid;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd.';
  end if;

  select * into v_customer
  from public.customers c
  where upper(c.invite_code) = upper(trim(p_code));
  if not found then
    raise exception 'Onbekende uitnodigingscode.';
  end if;

  select m.id into v_member
  from public.customer_members m
  where m.customer_id = v_customer.id and m.user_id = auth.uid();

  if v_member is null then
    select m.id into v_member
    from public.customer_members m
    where m.customer_id = v_customer.id
      and m.user_id is null
      and lower(coalesce(m.email, '')) = lower(v_email)
      and v_email <> ''
    limit 1;

    if v_member is not null then
      update public.customer_members m
        set user_id = auth.uid(),
            active  = true,
            name    = coalesce(nullif(trim(p_name), ''), m.name)
        where m.id = v_member;
    else
      insert into public.customer_members (customer_id, user_id, name, email, active)
      values (
        v_customer.id,
        auth.uid(),
        coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1), 'Medewerker'),
        nullif(v_email, ''),
        true
      )
      returning id into v_member;
    end if;
  end if;

  -- Eerste beheerder van dit klantbedrijf.
  if not exists (
    select 1 from public.customer_members m
    where m.customer_id = v_customer.id and m.is_admin
  ) then
    update public.customer_members m set is_admin = true where m.id = v_member;
  end if;

  return query select v_customer.id, v_customer.name;
end;
$$;

-- ─── 3. my_customer() geeft ook member_id, is_admin en invite_code terug ────
-- (return-type wijzigt, dus eerst droppen; de app leest kolommen op naam en
-- blijft dus werken.) invite_code zodat de beheerder de code voor collega's
-- vanuit de klant-app kan doorgeven -- leden zijn zelf al met die code
-- binnengekomen, dus dit lekt niets nieuws.

drop function if exists public.my_customer();

create or replace function public.my_customer()
returns table (customer_id uuid, customer_name text, member_name text, member_id uuid, is_admin boolean, invite_code text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, m.name, m.id, m.is_admin, c.invite_code
  from public.customer_members m
  join public.customers c on c.id = m.customer_id
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
$$;

-- ─── 4. Medewerkers lezen ────────────────────────────────────────────────────
-- Zichtbaar voor élk actief lid (net als artikelen: zichtbaarheid is per
-- bedrijf, alleen bewérken is beheerder-werk -- DATAMODEL-besluit 2026-06-14).

create or replace function public.my_members()
returns table (
  id uuid,
  name text,
  role text,
  phone text,
  email text,
  active boolean,
  is_admin boolean,
  has_account boolean,
  is_me boolean
)
language sql
security definer
set search_path = public
as $$
  select
    m.id, m.name, m.role, m.phone, m.email, m.active, m.is_admin,
    (m.user_id is not null) as has_account,
    coalesce(m.user_id = auth.uid(), false) as is_me
  from public.customer_members m
  where m.customer_id = (
    select me.customer_id from public.customer_members me
    where me.user_id = auth.uid() and me.active
    order by me.created_at limit 1
  )
  order by m.active desc, m.name;
$$;

-- ─── 5. Medewerker toevoegen/bewerken (alleen beheerders) ───────────────────
-- p_id leeg = nieuw lid (zonder account; een collega koppelt zijn account
-- later zelf via de uitnodigingscode, de e-mail-hereniging in
-- join_customer_by_invite plakt hem dan aan deze rij). Vergrendel-vangnet:
-- je kunt jezelf niet inactief of niet-beheerder maken, anders sluit de
-- laatste beheerder zichzelf (en daarmee het bedrijf) buiten.

create or replace function public.save_my_member(
  p_name text,
  p_role text default null,
  p_phone text default null,
  p_email text default null,
  p_active boolean default true,
  p_is_admin boolean default false,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       public.customer_members%rowtype;
  v_target   public.customer_members%rowtype;
  v_id       uuid;
begin
  select m.* into v_me
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_me.id is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if not v_me.is_admin then
    raise exception 'Alleen een beheerder kan medewerkers beheren.';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Naam is verplicht.';
  end if;

  if p_id is null then
    insert into public.customer_members (customer_id, name, role, phone, email, active, is_admin)
    values (
      v_me.customer_id,
      trim(p_name),
      nullif(trim(coalesce(p_role, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      coalesce(p_active, true),
      coalesce(p_is_admin, false)
    )
    returning id into v_id;
    return v_id;
  end if;

  select m.* into v_target
  from public.customer_members m
  where m.id = p_id and m.customer_id = v_me.customer_id;
  if v_target.id is null then
    raise exception 'Medewerker niet gevonden bij jouw bedrijf.';
  end if;
  if v_target.id = v_me.id and (not coalesce(p_active, true) or not coalesce(p_is_admin, false)) then
    raise exception 'Je kunt jezelf niet inactief of niet-beheerder maken.';
  end if;

  update public.customer_members
  set name     = trim(p_name),
      role     = nullif(trim(coalesce(p_role, '')), ''),
      phone    = nullif(trim(coalesce(p_phone, '')), ''),
      email    = nullif(trim(coalesce(p_email, '')), ''),
      active   = coalesce(p_active, true),
      is_admin = coalesce(p_is_admin, false)
  where id = v_target.id;
  return v_target.id;
end;
$$;

-- ─── 6. Artikel toevoegen door de klant ─────────────────────────────────────
-- Elk actief lid mag materiaal aanmelden (zelfde lijn als retire_my_article:
-- afvoeren mag ook door elk lid). Catalogus-match via p_product_id
-- (search_products werkt voor klant-accounts: de products-leespolicy uit
-- 20260713 geldt voor alle ingelogden); geen match = vrije invoer, en die
-- gaat automatisch de catalogus-wachtrij in (suggest_for_catalog, BOUWPLAN
-- fase 3: "onbekend product → wachtrij"). source='customer' zodat de
-- keurmeester ziet waar het artikel vandaan komt.

alter table public.articles drop constraint if exists articles_source_check;
alter table public.articles
  add constraint articles_source_check check (source in ('app', 'import', 'customer')) not valid;
alter table public.articles validate constraint articles_source_check;

create or replace function public.add_my_article(
  p_product_id uuid default null,
  p_free_brand text default null,
  p_free_category text default null,
  p_free_description text default null,
  p_serial_number text default null,
  p_assigned_user_name text default null,
  p_manufacture_year int default null,
  p_manufacture_month int default null,
  p_first_use_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_id       uuid;
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

  insert into public.articles (
    customer_id, product_id,
    free_brand, free_category, free_description,
    serial_number, assigned_user_name,
    manufacture_year, manufacture_month, first_use_date,
    suggest_for_catalog, source, retired
  )
  values (
    v_customer,
    p_product_id,
    case when p_product_id is null then nullif(trim(coalesce(p_free_brand, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_category, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_description, '')), '') end,
    nullif(trim(coalesce(p_serial_number, '')), ''),
    nullif(trim(coalesce(p_assigned_user_name, '')), ''),
    p_manufacture_year,
    p_manufacture_month,
    p_first_use_date,
    (p_product_id is null),
    'customer',
    false
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.join_customer_by_invite(text, text) to authenticated;
grant execute on function public.my_customer() to authenticated;
grant execute on function public.my_members() to authenticated;
grant execute on function public.save_my_member(text, text, text, text, boolean, boolean, uuid) to authenticated;
grant execute on function public.add_my_article(uuid, text, text, text, text, text, int, int, date) to authenticated;
