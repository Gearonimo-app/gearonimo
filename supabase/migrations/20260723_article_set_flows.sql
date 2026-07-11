-- Sets: intuïtievere samenstel-flow (besloten met Jos 2026-07-11).
--
-- Twee losstaande verbeteringen op de bestaande article_sets/article_set_members
-- (20260623_article_sets.sql, RLS-policies in 20260713_rls_enable.sql):
--
-- 1. "Onderdeel toevoegen tijdens keuring/materiaalbeheer" -- de kernvraag van
--    Jos: een klimgordel is het hoofdartikel, een vervangen onderdeel (bv. een
--    nieuwe brug met eigen SN) moet in ÉÉN actie aan dat hoofdartikel gekoppeld
--    worden, zonder los te hoeven zoeken/koppelen achteraf. get_or_create_article_set
--    is de gedeelde helper hiervoor: vindt (of maakt) de set van het hoofdartikel,
--    hangt er het nieuwe artikel aan met een vrije rol ("brug"), en voert
--    optioneel het vervangen onderdeel af (net als de bestaande "Afvoeren"-actie:
--    retired = true, geen harde delete, terug te zetten). Security definer met
--    een eigen toegangscheck (actieve inspector van het bedrijf, óf actief lid
--    van het klantbedrijf) zodat zowel de Pro-app (tijdens een keuring) als de
--    klant-app (materiaal beheren) 'm rechtstreeks kunnen aanroepen -- één
--    implementatie, geen gedupliceerde SQL/TS-logica.
--
-- 2. Klant-pariteit voor "groepeer bestaande artikelen tot een set" (de
--    verbeterde optie 2/3-flow die de Pro-app al krijgt via directe
--    tabel-calls, want inspectors hebben RLS-tabeltoegang). Klant-accounts
--    hebben sinds de RLS-ronde GEEN directe tabeltoegang (20260713), dus die
--    krijgen twee nieuwe RPC's: my_article_sets (lezen, voor de badges +
--    setweergave) en create_my_article_set (schrijven).

-- ─── A. get_or_create_article_set ────────────────────────────────────────

create or replace function public.get_or_create_article_set(
  p_customer_id uuid,
  p_primary_article_id uuid,
  p_primary_label text,
  p_new_article_id uuid,
  p_role text default null,
  p_retire_article_id uuid default null,
  p_retire_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id uuid;
begin
  if not (
    p_customer_id in (select public.inspector_customer_ids())
    or p_customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    )
  ) then
    raise exception 'Geen toegang tot dit klantbedrijf.';
  end if;

  if not exists (
    select 1 from public.articles
    where id = p_primary_article_id and customer_id = p_customer_id
  ) then
    raise exception 'Hoofdartikel niet gevonden bij dit klantbedrijf.';
  end if;
  if not exists (
    select 1 from public.articles
    where id = p_new_article_id and customer_id = p_customer_id
  ) then
    raise exception 'Nieuw artikel niet gevonden bij dit klantbedrijf.';
  end if;

  -- Bestaat er al een set met het hoofdartikel erin? Die hergebruiken
  -- (de oudste, voor het geval er ooit meerdere zouden zijn).
  select s.id into v_set_id
  from public.article_sets s
  join public.article_set_members m
    on m.set_id = s.id and m.article_id = p_primary_article_id
  where s.customer_id = p_customer_id
  order by s.created_at
  limit 1;

  if v_set_id is null then
    insert into public.article_sets (customer_id, name)
    values (p_customer_id, coalesce(nullif(trim(p_primary_label), ''), 'Set'))
    returning id into v_set_id;

    insert into public.article_set_members (set_id, article_id, role)
    values (v_set_id, p_primary_article_id, 'hoofdartikel')
    on conflict (set_id, article_id) do nothing;
  end if;

  insert into public.article_set_members (set_id, article_id, role)
  values (v_set_id, p_new_article_id, nullif(trim(coalesce(p_role, '')), ''))
  on conflict (set_id, article_id) do update set role = excluded.role;

  if p_retire_article_id is not null then
    if not exists (
      select 1 from public.articles
      where id = p_retire_article_id and customer_id = p_customer_id
    ) then
      raise exception 'Te vervangen artikel niet gevonden bij dit klantbedrijf.';
    end if;

    delete from public.article_set_members
    where set_id = v_set_id and article_id = p_retire_article_id;

    update public.articles
    set retired = true,
        retired_at = now(),
        retired_reason = coalesce(nullif(trim(p_retire_reason), ''), 'Vervangen')
    where id = p_retire_article_id;
  end if;

  return v_set_id;
end;
$$;

grant execute on function public.get_or_create_article_set(
  uuid, uuid, text, uuid, text, uuid, text
) to authenticated;

-- ─── B. Klant-pariteit: sets lezen + groeperen ───────────────────────────

create or replace function public.my_article_sets()
returns table (
  set_id uuid,
  set_name text,
  article_id uuid,
  role text,
  article_label text,
  serial_number text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.name, m.article_id, m.role,
    coalesce(p.brand || ' ' || p.name, p.name, a.free_brand || ' ' || a.free_description, a.free_description) as article_label,
    a.serial_number
  from public.article_sets s
  join public.article_set_members m on m.set_id = s.id
  join public.articles a on a.id = m.article_id
  left join public.products p on p.id = a.product_id
  where s.customer_id = (
    select cm.customer_id from public.customer_members cm
    where cm.user_id = auth.uid() and cm.active
    order by cm.created_at limit 1
  )
  order by s.created_at desc;
$$;

create or replace function public.create_my_article_set(
  p_name text,
  p_article_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_member uuid;
  v_set_id uuid;
begin
  select m.customer_id, m.id into v_customer, v_member
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if p_article_ids is null or array_length(p_article_ids, 1) is null then
    raise exception 'Kies minstens één artikel.';
  end if;
  if exists (
    select 1 from unnest(p_article_ids) as aid
    where not exists (
      select 1 from public.articles a where a.id = aid and a.customer_id = v_customer
    )
  ) then
    raise exception 'Eén of meer artikelen horen niet bij jouw bedrijf.';
  end if;

  insert into public.article_sets (customer_id, name, created_by_member_id)
  values (v_customer, coalesce(nullif(trim(p_name), ''), 'Set'), v_member)
  returning id into v_set_id;

  insert into public.article_set_members (set_id, article_id)
  select v_set_id, aid from unnest(p_article_ids) as aid;

  return v_set_id;
end;
$$;

grant execute on function public.my_article_sets() to authenticated;
grant execute on function public.create_my_article_set(text, uuid[]) to authenticated;
