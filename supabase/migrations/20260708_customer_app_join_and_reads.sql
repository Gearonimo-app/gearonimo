-- Fase 3, slice 1: de klant-app (BOUWPLAN fase 3, DATAMODEL §customer_members).
--
-- Koppelen via uitnodigingscode + veilige lees-RPC's. Belangrijk
-- vertrouwensmodel: RLS staat (tijdelijk) uit met brede GRANTs aan
-- `authenticated`, en met de klant-app krijgen straks EXTERNE gebruikers een
-- account. Daarom loopt alles wat de klant-app leest via security
-- definer-RPC's die zélf op auth.uid() scopen -- de app heeft geen directe
-- tabel-toegang nodig. De echte RLS-ronde blijft op de todo (BOUWPLAN), maar
-- dit voorkomt dat de klant-app daarop moet wachten.

-- 1. Uitnodigingscode per klantbedrijf (DATAMODEL: customers.invite_code).
--    Kort en voorleesbaar (8 tekens hex, hoofdletters): de keurmeester geeft
--    'm telefonisch of op papier door aan zijn klant.
alter table public.customers
  add column if not exists invite_code text;

update public.customers
  set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
  where invite_code is null;

alter table public.customers
  alter column invite_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8));

alter table public.customers
  alter column invite_code set not null;

create unique index if not exists customers_invite_code_key
  on public.customers (invite_code);

-- 2. Koppeling medewerker <-> account (DATAMODEL: customer_members.user_id).
--    Nullable: door de keurmeester ingevoerde medewerkers hebben (nog) geen
--    eigen account. Eén account hoort maximaal één keer bij hetzelfde
--    klantbedrijf.
alter table public.customer_members
  add column if not exists user_id uuid references auth.users (id);

create unique index if not exists customer_members_customer_user_key
  on public.customer_members (customer_id, user_id)
  where user_id is not null;

-- 3. Koppelen met een uitnodigingscode. Hergebruikt een bestaande,
--    account-loze medewerker-rij met hetzelfde e-mailadres (door de
--    keurmeester ingevoerd) i.p.v. een duplicaat aan te maken.
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
      );
    end if;
  end if;

  return query select v_customer.id, v_customer.name;
end;
$$;

-- 4. Mijn klantbedrijf (voor de app om te weten of/waaraan dit account
--    gekoppeld is). Eén bedrijf per account voor nu; mocht een account ooit
--    bij meerdere bedrijven horen, dan pakt dit de oudste koppeling.
create or replace function public.my_customer()
returns table (customer_id uuid, customer_name text, member_name text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, m.name
  from public.customer_members m
  join public.customers c on c.id = m.customer_id
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
$$;

-- 5. Mijn artikelen, met het laatste afgeronde keuringsresultaat per artikel
--    (voor het "ben ik in orde"-dashboard; de statusberekening zelf gebeurt
--    client-side met packages/core calcStatus, de geteste domeinlogica).
create or replace function public.my_articles()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  serial_number text,
  assigned_user_name text,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date
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
    a.serial_number,
    a.assigned_user_name,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due
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
  where a.retired = false
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

-- 6. Mijn certificaten (afgeronde keuringen van mijn bedrijf). De PDF staat
--    in de publieke certificates-bucket met een ongokbaar uuid-pad, zelfde
--    vertrouwensmodel als de verificatie-QR.
create or replace function public.my_certificates()
returns table (
  inspection_id uuid,
  number text,
  storage_path text,
  inspection_date date,
  completed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select i.id, c.number, c.storage_path, i.inspection_date, i.completed_at
  from public.inspections i
  join public.certificates c on c.inspection_id = i.id
  where i.status = 'completed'
    and i.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    )
  order by i.completed_at desc nulls last;
$$;

grant execute on function public.join_customer_by_invite(text, text) to authenticated;
grant execute on function public.my_customer() to authenticated;
grant execute on function public.my_articles() to authenticated;
grant execute on function public.my_certificates() to authenticated;

-- 7. ensure_inspector dichtgetimmerd. De oude versie maakte voor ELKE
--    ingelogde gebruiker automatisch een keurmeester-rij aan -- prima zolang
--    alleen keurmeesters konden inloggen, maar met de klant-app krijgen
--    externe gebruikers een account op hetzelfde domein. Een klant-account
--    (customer_members.user_id) dat de inspector-app opent wordt nu geweigerd
--    i.p.v. stilletjes keurmeester bij Safety Green te worden. Bestaande
--    keurmeesters (met een inspectors-rij) blijven gewoon werken, ook als ze
--    daarnaast lid van een klantbedrijf zijn (testen door Jos).
--    NB: de bredere afsluiting (uitnodigingsflow voor nieuwe keurmeesters,
--    RLS aan) staat als eigen ronde in het BOUWPLAN.
create or replace function public.ensure_inspector()
returns public.inspectors
language plpgsql
security definer
set search_path = public
as $function$
declare
  result public.inspectors;
  first_company_id uuid;
begin
  if not exists (select 1 from public.inspectors i where i.user_id = auth.uid())
     and exists (select 1 from public.customer_members m where m.user_id = auth.uid()) then
    raise exception 'Dit account is een klant-account, geen keurmeester-account.';
  end if;

  select id into first_company_id from public.inspection_companies order by created_at limit 1;

  insert into public.inspectors (user_id, company_id, name)
  values (auth.uid(), first_company_id, (select email from auth.users where id = auth.uid()))
  on conflict (user_id) do nothing;

  select * into result from public.inspectors where user_id = auth.uid();
  return result;
end;
$function$;
