# Migraties uitvoeren — stap voor stap (30 augustus 2026)

De SQL staat hieronder volledig uitgeschreven. Je hoeft geen bestanden te
zoeken: openen, kopiëren, plakken, Run. Vier blokken, ±10 minuten.

**Nodig:** je Supabase-login. Verder niets.

---

## Wat je merkt zonder deze migraties

| Blok | Zonder deze migratie |
|---|---|
| 1 | De aankoopdatum telt niet mee, waardoor een net gekochte EHBO-koffer meteen om aandacht vraagt. |
| 2 | Je vinkt iets af en het artikelscherm blijft "Nog niet gekeurd" tonen; de naam die je invulde komt nergens terug. |
| 3 | Dezelfde combinatie merk + naam kan nog twee keer in de catalogus. |
| 4 | "Wachtwoord instellen" in Bedrijven geeft een foutmelding. |

> **Draai `20260749_catalog_reset_and_unique.sql` niet.** Dat bestand staat nog
> in de map en oogt onschuldig, maar het koppelt élk artikel los van zijn
> catalogusproduct en maakt daarna de catalogus leeg. Je koppelwerk zou weg zijn.
> Blok 3 hieronder bevat het enige stuk dat nog nodig was.

**Waarom dit korter is dan de vier migratiebestanden:** migratie 20260755 maakt
twee functies aan, maar de tweede daarvan (`my_article_detail`) wordt meteen
daarna volledig overschreven door 20260756. Die overbodige stap staat hier niet
in. Daarmee vervalt ook de volgordeval die anders had gekund.

---

## Stap 1 — Supabase openen

Ga naar https://supabase.com/dashboard, log in, kies project
**`buitfeiclivzzldfdelp`**.

## Stap 2 — Naar de SQL-editor

Klik in de linkerbalk op **SQL Editor** (icoontje `>_`), dan bovenin op
**+ New query**. Je krijgt een leeg tekstvak.

---

## Blok 1 — `my_articles` met de aankoopdatum

Plak dit, klik **Run**. **Verwacht:** `Success. No rows returned`.

```sql
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
```

---

## Blok 2 — `my_article_detail` met zelfcontroles en de naam

Maak een nieuwe query (**+ New query**), plak dit, klik **Run**.
**Verwacht:** `Success. No rows returned`.

```sql
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
```

---

## Blok 3 — Het slot op dubbele producten

Nieuwe query, plakken, **Run**.

```sql
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
```

**Verwacht:** `Success`, en onderin bij de meldingen:

```
Unieke index products_brand_name_uniq staat klaar.
```

**Staat er in plaats daarvan** `Let op: nog N dubbele merk+naam-combinaties` —
dan zijn er nog dubbelen en is het slot bewust niet gezet. Geef dat getal door;
de rest van het testplan kun je gewoon doen.

---

## Blok 4 — Wachtwoord instellen voor een keurmeester

Alleen nodig voor fase 7 van het testplan. Nieuwe query, plakken, **Run**.

```sql
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
```

**Verwacht:** `Success. No rows returned`.

Deze schrijft in `auth.users`, de interne inlogtabel van Supabase. Dat is bewust
en volgt het gangbare Supabase-patroon, maar test hem in fase 7 één keer op één
account (wachtwoord instellen → uitloggen → inloggen met e-mail + wachtwoord)
voordat je erop vertrouwt.

---

## Stap 3 — Controleren dat alles goed staat

Nieuwe query, plakken, **Run**:

```sql
select
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_articles')                as fn_my_articles,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_article_detail')          as fn_article_detail,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'platform_admin_set_inspector_password')               as fn_set_password,
  (select count(*) from pg_indexes
    where tablename = 'products' and indexname = 'products_brand_name_uniq') as slot_op_dubbelen,
  (select count(*) from public.products)                                     as producten,
  (select count(*) from public.articles where product_id is not null)        as gekoppelde_artikelen;
```

**Verwacht:**

| kolom | waarde |
|---|---|
| `fn_my_articles` | **1** |
| `fn_article_detail` | **1** |
| `fn_set_password` | **1** |
| `slot_op_dubbelen` | **1** (of 0 als je de "nog N dubbelen"-melding kreeg) |
| `producten` | een paar duizend — **schrijf dit getal op**, je hebt het bij fase 5 nodig |
| `gekoppelde_artikelen` | ongeveer wat je met de hand hebt gekoppeld |

En als laatste, de controle dat de naam bij de controle er echt in zit:

```sql
select
  pg_get_function_result(p.oid) like '%self_performed_by%' as naam_zit_erin,
  pg_get_function_result(p.oid) like '%self_checked_at%'   as datum_zit_erin
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'my_article_detail';
```

**Verwacht:** één regel met **`true`** in beide kolommen. Staat er `false` bij
`naam_zit_erin`, draai dan blok 2 nog een keer.

---

## Als er iets misgaat

**"permission denied for table ..."** — een tabel mist een `grant`. Stuur de
volledige melding door; bekend patroon hier, zo opgelost.

**"violates foreign key constraint"** — meestal een FK die naar de lege tabel
`public.users` wijst in plaats van naar `auth.users`. Dat is hier al drie keer
gebeurd. Stuur de melding door.

**"function ... already exists with same argument types"** — kan bij deze vier
niet gebeuren (ze droppen allemaal eerst). Komt het toch: melding doorsturen.

**Kwijt welk blok je gedraaid had** — niet erg. Alle vier zijn idempotent: draai
ze gewoon opnieuw van 1 naar 4.

**Iets anders** — kopieer de hele rode melding en stuur hem door. Verzin niets
zelf in de SQL-editor; deze database heeft echte klantgegevens.

---

## Daarna

Ga naar **`TESTPLAN.md`**, fase 0b (schoon herstarten), en werk het plan van
daaruit door.

> De losse migratiebestanden blijven in `supabase/migrations/` staan als
> bronarchief. `supabase/UITVOEREN-2026-08-30.sql` bevat dezelfde vier migraties
> ongewijzigd achter elkaar, voor wie ze liever in één keer draait.
