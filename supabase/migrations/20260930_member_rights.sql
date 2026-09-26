-- Rechten van een gewone gebruiker in de klant-app (besluit Jos 2026-09-26,
-- BOUWPLAN "Besluit: klantrollen, eigenaar per artikel, inloggen", stap 3).
--
--   * "In gebruik sinds" invullen: elke gebruiker, eenmalig (daarna vast,
--     ook voor de beheerder). Bij elk artikel van het bedrijf -- ook bij
--     "Voorraad": wie iets nieuws uit de voorraad pakt, is daar (nog) niet
--     de eigenaar van. De app toont erbij: alleen bij eerste gebruik, nieuw
--     uit de verpakking, niet bij overdracht aan een collega.
--   * Afvoeren (kapot / kwijt / gestolen): gebruiker alleen zijn EIGEN
--     spullen (articles.assigned_member_id = hijzelf), beheerder alles.
--   * Afvoeren terugdraaien: gebruiker wat hij zelf afvoerde, beheerder
--     alles. Daarvoor wordt nu vastgelegd wie afvoerde.
--   * Artikel aanpassen (update_my_article) blijft beheerderswerk.
--
-- Idempotent. Nog uit te voeren door Jos in de Supabase SQL-editor.

-- ─── 0. Wie voerde af ───────────────────────────────────────────────────────
alter table public.articles
  add column if not exists retired_by_member_id uuid
  references public.customer_members(id) on delete set null;

-- ─── 1. "In gebruik sinds" (eenmalig, iedere gebruiker) ─────────────────────
create or replace function public.set_my_first_use_date(p_article_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if p_date is null then
    raise exception 'Kies een datum.';
  end if;
  if p_date > current_date then
    raise exception 'De datum kan niet in de toekomst liggen.';
  end if;

  update public.articles a
  set first_use_date = p_date
  where a.id = p_article_id
    and a.customer_id = v_customer
    and a.retired = false
    and a.first_use_date is null;

  if not found then
    raise exception 'Artikel niet gevonden, of "in gebruik sinds" is al ingevuld.';
  end if;
end;
$$;

grant execute on function public.set_my_first_use_date(uuid, date) to authenticated;

-- ─── 2. Afvoeren: gebruiker eigen spullen, beheerder alles ──────────────────
create or replace function public.retire_my_article(p_article_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_member   uuid;
  v_is_admin boolean;
begin
  select m.customer_id, m.id, m.is_admin into v_customer, v_member, v_is_admin
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.customer_id = v_customer and a.retired = false
  ) then
    raise exception 'Artikel niet gevonden bij jouw bedrijf.';
  end if;

  if not coalesce(v_is_admin, false) and not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.assigned_member_id = v_member
  ) then
    raise exception 'Je kunt alleen je eigen spullen afvoeren. Vraag de beheerder.';
  end if;

  update public.articles
  set retired = true,
      retired_at = now(),
      retired_reason = nullif(trim(coalesce(p_reason, '')), ''),
      retired_by_member_id = v_member
  where id = p_article_id;
end;
$$;

-- ─── 3. Afvoeren terugdraaien ───────────────────────────────────────────────
create or replace function public.restore_my_article(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_member   uuid;
  v_is_admin boolean;
begin
  select m.customer_id, m.id, m.is_admin into v_customer, v_member, v_is_admin
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  update public.articles a
  set retired = false,
      retired_at = null,
      retired_reason = null,
      retired_by_member_id = null
  where a.id = p_article_id
    and a.customer_id = v_customer
    and a.retired = true
    and (coalesce(v_is_admin, false) or a.retired_by_member_id = v_member);

  if not found then
    raise exception 'Terugzetten kan alleen door wie het afvoerde, of door de beheerder.';
  end if;
end;
$$;

grant execute on function public.restore_my_article(uuid) to authenticated;

-- ─── 4. Afgevoerde spullen (om terug te kunnen zetten) ──────────────────────
-- Laatste 12 maanden: daarna is terugzetten niet meer aan de orde, en de
-- lijst blijft kort. De historie zelf blijft altijd bewaard.
create or replace function public.my_retired_articles()
returns table (
  id uuid,
  name text,
  brand text,
  serial_number text,
  assigned_user_name text,
  retired_at timestamptz,
  retired_reason text,
  retired_by_name text,
  can_restore boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.customer_id, m.id as member_id, m.is_admin
    from public.customer_members m
    where m.user_id = auth.uid() and m.active
    order by m.created_at
    limit 1
  )
  select
    a.id,
    coalesce(p.name, a.free_description)  as name,
    coalesce(p.brand, a.free_brand)       as brand,
    a.serial_number,
    a.assigned_user_name,
    a.retired_at,
    a.retired_reason,
    rb.name                               as retired_by_name,
    coalesce(me.is_admin or a.retired_by_member_id = me.member_id, false) as can_restore
  from me
  join public.articles a on a.customer_id = me.customer_id
  left join public.products p on p.id = a.product_id
  left join public.customer_members rb on rb.id = a.retired_by_member_id
  where a.retired = true
    and (a.retired_at is null or a.retired_at > now() - interval '12 months')
  order by a.retired_at desc nulls last;
$$;

grant execute on function public.my_retired_articles() to authenticated;
