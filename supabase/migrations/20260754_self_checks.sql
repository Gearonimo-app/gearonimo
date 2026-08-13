-- Zelf afvinken: de eigen todo-lijst van de klant (besluit Jos 2026-08-04:
-- "other, door de klant af te vinken, na 12mnd weer herinnering. Geen
-- officiële keurlijst dus, meer een klant eigen todo lijst").
--
-- De tabel `self_checks` bestond al live maar had géén `create table` in de
-- repo -- hij is ooit rechtstreeks in Supabase aangemaakt. De kolommen zijn
-- door Jos geverifieerd (2026-08-04) en komen exact overeen met DATAMODEL §3:
--   id, article_id, checked_at, performed_by, next_due, attachment_url,
--   created_by_member_id, created_at
-- Deze migratie maakt hem daarom alleen aan als hij ontbreekt, en regelt
-- verder de FK's, rechten en de RPC's.

create table if not exists public.self_checks (
  id                   uuid primary key default gen_random_uuid(),
  article_id           uuid not null,
  checked_at           date not null,
  performed_by         text,
  next_due             date,
  attachment_url       text,
  created_by_member_id uuid,
  created_at           timestamptz not null default now()
);

-- ─── FK's expliciet goedzetten ──────────────────────────────────────────────
-- Bekend patroon in deze repo (drie keer misgegaan, zie CLAUDE.md): een kolom
-- die al bestond hield een FK naar het lege public.users. Hier hangt
-- created_by_member_id aan customer_members. Droppen-en-opnieuw-zetten is
-- idempotent en zelfherstellend.

alter table public.self_checks
  drop constraint if exists self_checks_article_id_fkey;
alter table public.self_checks
  add constraint self_checks_article_id_fkey
  foreign key (article_id) references public.articles(id) on delete cascade;

alter table public.self_checks
  drop constraint if exists self_checks_created_by_member_id_fkey;
alter table public.self_checks
  add constraint self_checks_created_by_member_id_fkey
  foreign key (created_by_member_id) references public.customer_members(id) on delete set null;

create index if not exists self_checks_article_idx
  on public.self_checks (article_id, checked_at desc);

-- RLS blijft aan zonder policies: klant-accounts hebben sinds 20260713 geen
-- directe tabeltoegang, alles loopt via security definer-RPC's. Wel de grant,
-- anders geeft PostgREST "permission denied for table" nog vóór RLS
-- (zie CLAUDE.md).
alter table public.self_checks enable row level security;
grant select, insert on public.self_checks to authenticated;

-- ─── 1. Afvinken ────────────────────────────────────────────────────────────

create or replace function public.add_my_self_check(
  p_article_id uuid,
  p_checked_at date default null,
  p_performed_by text default null,
  p_next_due date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_member   uuid;
  v_checked  date;
  v_type     text;
  v_interval int;
  v_id       uuid;
begin
  select m.customer_id, m.id into v_customer, v_member
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  -- Alleen eigen materiaal, en alleen wat buiten het keurbedrijf valt: een
  -- artikel dat een keurmeester keurt mag de klant niet zelf afmelden (dat zou
  -- de juridische status vertroebelen, zie DATAMODEL §3).
  select coalesce(p.product_type, a.free_product_type) into v_type
  from public.articles a
  left join public.products p on p.id = a.product_id
  where a.id = p_article_id
    and a.customer_id = v_customer
    and a.retired = false
    and a.self_managed = true;
  if not found then
    raise exception 'Artikel niet gevonden, of het wordt door een keurbedrijf gekeurd.';
  end if;

  v_checked := coalesce(p_checked_at, current_date);
  if v_checked > current_date then
    raise exception 'Een controle kan niet in de toekomst liggen.';
  end if;

  -- Spiegel van selfCheckIntervalMonths() in packages/core/src/domains.ts.
  v_interval := case coalesce(nullif(trim(v_type), ''), 'ppe')
    when 'other'   then 12
    when 'machine' then 12
    else null
  end;

  insert into public.self_checks (article_id, checked_at, performed_by, next_due, created_by_member_id)
  values (
    p_article_id,
    v_checked,
    nullif(trim(coalesce(p_performed_by, '')), ''),
    -- Zelf ingevuld wint; anders het standaardinterval. Geen interval (kleding)
    -- => geen volgende datum, dan is dit puur een aantekening.
    coalesce(
      p_next_due,
      case when v_interval is not null then (v_checked + make_interval(months => v_interval))::date end
    ),
    v_member
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.add_my_self_check(uuid, date, text, date) to authenticated;

-- ─── 2. my_articles() geeft de laatste zelfcontrole mee ─────────────────────
-- Zelfde functie als in 20260752, plus `self_managed`, `self_checked_at` en
-- `self_next_due`. `self_managed` erbij zodat de app op de échte vlag kan
-- vertakken en niet op het producttype: zet Jos ooit machines terug naar het
-- keurbedrijf, dan volgt de app vanzelf.

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

-- ─── 3. De historie per artikel ─────────────────────────────────────────────
-- Voor het artikeldetailscherm: alle controles, nieuwste eerst.

create or replace function public.my_self_checks(p_article_id uuid)
returns table (
  id uuid,
  checked_at date,
  performed_by text,
  next_due date,
  member_name text
)
language sql
security definer
set search_path = public
as $$
  select s.id, s.checked_at, s.performed_by, s.next_due, m.name
  from public.self_checks s
  join public.articles a on a.id = s.article_id
  left join public.customer_members m on m.id = s.created_by_member_id
  where s.article_id = p_article_id
    and a.customer_id = (
      select cm.customer_id from public.customer_members cm
      where cm.user_id = auth.uid() and cm.active
      order by cm.created_at limit 1
    )
  order by s.checked_at desc, s.created_at desc;
$$;

grant execute on function public.my_self_checks(uuid) to authenticated;
