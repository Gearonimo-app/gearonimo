-- Correctie-route weer weg (besluit Jos, 2026-09-24).
--
-- Jos: "waarom kan dit niet bij een vergissing dan? een keurmeester die een
-- vergissing opslaat is zowiezo niet de bedoeling" en "ik vind het ook fijn
-- als er geen onnodige code in staat". Voortaan is er één route voor alles
-- (vergissing, reparatie, uit quarantaine): een nieuwe keuring, en dus een
-- tweede certificaat. De app toont altijd de nieuwste status.
--
-- Wat blijft: afgeronde keuringen, items en certificaten zijn onveranderlijk
-- (de triggers uit 20260917). Alleen de foutmeldingen verwijzen niet meer
-- naar correct_inspection().
--
-- Wat verdwijnt: correct_inspection(), de "gecorrigeerd"-velden in
-- verify_certificate() (terug naar de versie van 20260746), de kolom
-- inspections.corrects_inspection_id en source = 'correction'. De kolom en de
-- source-waarde gaan er alleen uit als er live geen correctie bestaat. Anders
-- blijven ze staan (met een NOTICE), zodat er geen keuring verdwijnt.
--
-- Idempotent.

-- ─── 1. Functie weg ──────────────────────────────────────────────────────
drop function if exists public.correct_inspection(uuid, jsonb);

-- ─── 2. Foutmeldingen van de onveranderlijkheid bijwerken ────────────────
create or replace function public.block_completed_inspection_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' and old.import_batch_id is null then
      raise exception 'Een afgeronde keuring kan niet verwijderd worden. Maak een nieuwe keuring aan.';
    end if;
    return old;
  end if;

  if old.status = 'completed' then
    raise exception 'Een afgeronde keuring kan niet meer gewijzigd worden. Maak een nieuwe keuring aan.';
  end if;
  return new;
end;
$$;

create or replace function public.block_completed_inspection_item_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
  v_import_batch_id uuid;
begin
  select status, import_batch_id into v_status, v_import_batch_id
  from public.inspections
  where id = coalesce(old.inspection_id, new.inspection_id);

  if tg_op = 'DELETE' then
    if v_status = 'completed' and v_import_batch_id is null then
      raise exception 'Items van een afgeronde keuring kunnen niet verwijderd worden.';
    end if;
    return old;
  end if;

  if v_status = 'completed' then
    raise exception 'Items van een afgeronde keuring kunnen niet meer gewijzigd worden. Maak een nieuwe keuring aan.';
  end if;
  return new;
end;
$$;

create or replace function public.block_completed_certificate_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.inspections where id = old.inspection_id;
  if v_status = 'completed' then
    raise exception 'Het certificaat van een afgeronde keuring kan niet meer gewijzigd of verwijderd worden. Maak een nieuwe keuring aan.';
  end if;
  return old;
end;
$$;

-- ─── 3. verify_certificate terug naar 20260746 ───────────────────────────
create or replace function public.verify_certificate(token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'number', c.number,
    'issued_at', c.issued_at,
    'pdf_hash', c.pdf_hash,
    'storage_path', c.storage_path,
    'company_name', ic.name,
    'customer_name', cu.name,
    'inspection_date', i.inspection_date,
    'inspector_name', insp.name,
    'qualifications', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', q.name,
        'number', q.number,
        'valid_until', q.valid_until,
        'public_path', q.public_path
      ) order by q.name), '[]'::jsonb)
      from inspector_qualifications q
      where q.inspector_id = i.inspector_id
        and q.public_path is not null
    ),
    'items', (
      select jsonb_agg(jsonb_build_object(
        'label', coalesce(
          nullif(trim(coalesce(p.brand, '') || ' ' || coalesce(p.name, '')), ''),
          nullif(trim(coalesce(snap->>'free_brand', '') || ' ' || coalesce(snap->>'free_description', '')), '')
        ),
        'serial_number', snap->>'serial_number',
        'result', ii.result,
        'next_due', ii.next_due
      ))
      from inspection_items ii
      left join articles a on a.id = ii.article_id
      cross join lateral (
        -- Bevroren artikelrij; live rij alleen als vangnet voor items van
        -- vóór de snapshot-kolom.
        select coalesce(ii.article_snapshot, to_jsonb(a)) as snap
      ) s
      left join products p on p.id = (snap->>'product_id')::uuid
      where ii.inspection_id = i.id
        and ii.result <> 'not_assessed'
    )
  )
  into result
  from certificates c
  join inspections i on i.id = c.inspection_id
  join inspection_companies ic on ic.id = i.company_id
  join customers cu on cu.id = i.customer_id
  left join inspectors insp on insp.id = i.inspector_id
  where c.verify_token = token;

  return result;
end;
$function$;

-- ─── 4. Kolom en source-waarde weg (alleen als er geen correctie bestaat) ─
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'inspections'
      and column_name = 'corrects_inspection_id'
  ) then
    if exists (select 1 from public.inspections where corrects_inspection_id is not null or source = 'correction') then
      raise notice 'Er bestaan al correcties: corrects_inspection_id en source=correction blijven staan.';
    else
      drop index if exists public.inspections_corrects_unique;
      drop index if exists public.inspections_corrects_inspection_id_idx;
      alter table public.inspections drop column corrects_inspection_id;
      alter table public.inspections drop constraint if exists inspections_source_check;
      alter table public.inspections
        add constraint inspections_source_check check (source in ('app', 'import'));
    end if;
  end if;
end;
$$;
