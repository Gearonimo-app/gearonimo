-- correct_inspection() bijwerken voor de kolommen van na 20260917 (Jos,
-- 2026-10-03: "los het op").
--
-- De functie kloont een afgeronde keuring naar een correctie-keuring, maar
-- nam alleen de kolommen mee die er in september waren. Daardoor viel bij een
-- correctie weg:
--   - approval_code_id     (goedkeuringscodes, 20261006)
--   - exam_type            (type keuring per regel, 20261007)
--   - exam_interval_months (termijn keuringsschema, 20261007)
-- Nu worden ze overgenomen, en kunnen ze net als de andere velden per item
-- overschreven worden via p_items.
--
-- Plus: codes horen bij de uitkomst. Werd alleen de uitkomst gecorrigeerd
-- (bv. goedgekeurd -> afgekeurd), dan bleef de oude code staan. Nu, net als in
-- de app (setResult), alleen een afkeurcode bij afgekeurd en alleen een
-- goedkeuringscode bij goedgekeurd.
--
-- De app roept deze functie op dit moment niet aan; dit voorkomt dat hij stil
-- gegevens kwijtraakt zodra dat wel gebeurt. Verder identiek aan 20260917 (C).
-- Idempotent: create or replace.

create or replace function public.correct_inspection(
  p_inspection_id uuid,
  p_items jsonb  -- [{item_id, result, rejection_code_id, approval_code_id, exam_type, exam_interval_months, comment, next_due}, ...]
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_original public.inspections;
  v_inspector_id uuid;
  v_new_id uuid;
  -- Certificaatnummer van de correctie: de base van het OORSPRONKELIJKE
  -- certificaat (nooit dat van een tussenliggende correctie) + -a/-b/... naar
  -- hoeveel stappen deze correctie van dat origineel verwijderd is. Wordt
  -- meteen bij aanmaken ingevuld (niet achteraf via update) -- de nieuwe rij
  -- staat al op 'completed' en is dus meteen onveranderlijk, ook voor onszelf.
  -- Boven de 26e correctie van dezelfde keuring loopt de letter door voorbij
  -- 'z' (zeer onwaarschijnlijk in de praktijk, bewust niet verder afgehandeld).
  v_depth integer := 1;
  v_walk uuid;
  v_parent uuid;
  v_root_id uuid;
  v_base_number text;
  v_new_number text;
begin
  select * into v_original from public.inspections where id = p_inspection_id;
  if v_original.id is null then
    raise exception 'Keuring niet gevonden.';
  end if;
  if v_original.status <> 'completed' then
    raise exception 'Alleen een afgeronde keuring kan gecorrigeerd worden.';
  end if;
  if v_original.company_id not in (select public.inspector_company_ids()) then
    raise exception 'Geen toegang tot deze keuring.';
  end if;
  if v_original.import_batch_id is not null then
    raise exception 'Een geïmporteerde keuring heeft geen eigen certificaat en kan niet gecorrigeerd worden.';
  end if;

  select id into v_inspector_id
  from public.inspectors
  where user_id = auth.uid() and active and company_id = v_original.company_id;
  if v_inspector_id is null then
    raise exception 'Geen actieve keurmeester bij dit keurbedrijf.';
  end if;

  v_walk := p_inspection_id;
  loop
    select corrects_inspection_id into v_parent from public.inspections where id = v_walk;
    if v_parent is null then
      v_root_id := v_walk;
      exit;
    end if;
    v_depth := v_depth + 1;
    v_walk := v_parent;
  end loop;

  select number into v_base_number from public.certificates where inspection_id = v_root_id;
  if v_base_number is null then
    raise exception 'Geen certificaat gevonden voor de oorspronkelijke keuring.';
  end if;
  v_new_number := v_base_number || '-' || chr(96 + v_depth);

  insert into public.inspections (
    customer_id, company_id, inspector_id, inspection_date, location,
    examination_type, status, completed_at, notes, source, corrects_inspection_id,
    certificate_number
  )
  values (
    v_original.customer_id, v_original.company_id, v_inspector_id, v_original.inspection_date,
    v_original.location, v_original.examination_type, 'completed', now(), v_original.notes,
    'correction', v_original.id, v_new_number
  )
  returning id into v_new_id;

  -- coalesce() alleen zou een EXPLICIET geleegd veld (bv. rejection_code_id
  -- terug naar null bij goedgekeurd -> afgekeurd) niet kunnen onderscheiden
  -- van "geen wijziging voor dit veld" -- allebei geven ov->>'x' = NULL. Met
  -- `ov ? 'x'` (bestaat de sleutel?) blijft dat onderscheid wel intact.
  insert into public.inspection_items (
    inspection_id, article_id, article_snapshot, result, next_due,
    rejection_code_id, approval_code_id, exam_type, exam_interval_months,
    comment, inspector_id
  )
  select
    v_new_id,
    oi.article_id,
    oi.article_snapshot,
    r.result,
    case when ov ? 'next_due' then nullif(ov->>'next_due', '')::date else oi.next_due end,
    -- Codes horen bij de uitkomst, net als in de app (setResult): een
    -- afkeurcode alleen bij afgekeurd, een goedkeuringscode alleen bij
    -- goedgekeurd -- ook als alleen de uitkomst is gecorrigeerd.
    case when r.result = 'rejected' then
      case when ov ? 'rejection_code_id' then nullif(ov->>'rejection_code_id', '')::uuid else oi.rejection_code_id end
    end,
    case when r.result = 'passed' then
      case when ov ? 'approval_code_id' then nullif(ov->>'approval_code_id', '')::uuid else oi.approval_code_id end
    end,
    case when ov ? 'exam_type' then nullif(ov->>'exam_type', '') else oi.exam_type end,
    case when ov ? 'exam_interval_months' then nullif(ov->>'exam_interval_months', '')::integer else oi.exam_interval_months end,
    case when ov ? 'comment' then ov->>'comment' else oi.comment end,
    v_inspector_id
  from public.inspection_items oi
  left join lateral (
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) value
    where (value->>'item_id')::uuid = oi.id
    limit 1
  ) as x(ov) on true
  cross join lateral (
    select case when ov ? 'result' then ov->>'result' else oi.result end as result
  ) as r
  where oi.inspection_id = p_inspection_id;

  return v_new_id;
end;
$function$;

grant execute on function public.correct_inspection(uuid, jsonb) to authenticated;
