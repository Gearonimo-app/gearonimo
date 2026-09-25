-- Correctie = klein certificaat met ALLEEN de gecorrigeerde artikelen
-- (besluit Jos, 2026-09-24).
--
-- Tot nu toe (20260917_completed_inspection_immutable.sql) kopieerde
-- correct_inspection() de HELE keuring naar een nieuwe keuring, en zei het
-- oude certificaat op de verificatiepagina als geheel "vervangen door X".
-- Jos wil het anders, net als bij de quarantaine straks: het oude
-- certificaat blijft geldig voor alle artikelen die niet veranderd zijn, en
-- er komt een klein nieuw certificaat bij met alleen de gecorrigeerde
-- artikelen. Afspraak: certificaten worden nooit aangepast, er komen alleen
-- nieuwe bij.
--
-- Gevolgen:
-- A. Eén keuring kan nu meerdere correcties krijgen (vandaag de gordel,
--    volgende week de lier). De unieke index van 20260917 ("één rechte
--    keten") gaat eruit. Wel geldt per artikel: een artikel dat al
--    gecorrigeerd is, corrigeer je verder vanaf dát nieuwe certificaat, niet
--    nog een keer vanaf het oude. Anders zijn er twee "nieuwste" versies.
-- B. correct_inspection() neemt alleen de meegegeven (gewijzigde) items over.
--    corrects_inspection_id wijst naar de keuring die je corrigeert. Dat kan
--    zelf ook een correctie zijn: dan ontstaat er een keten per artikel.
--    Het nummer blijft de basis van het oorspronkelijke certificaat plus de
--    volgende vrije letter binnen die hele familie (-a, -b, ...).
-- C. verify_certificate() geeft per artikel 'corrected_by' mee (het nieuwere
--    certificaat voor dít artikel) en bovenaan 'corrects' (het certificaat
--    dat deze correctie aanvult). 'superseded_by' blijft als sleutel bestaan
--    maar is voortaan altijd null. Zo breekt een oude, gecachte versie van
--    de verificatiepagina niet.
--
-- De status van een artikel verandert hier niet: alle "nieuwste keuring per
-- artikel"-logica sorteert al op inspection_date, en daarna op
-- completed_at/created_at (20260738, 20260762, findPreviousResult). Een
-- correctie heeft dezelfde keurdatum en wordt later afgerond, dus die wint
-- vanzelf. En alleen voor de artikelen die er echt op staan.
--
-- Idempotent.

-- ─── A. Meerdere correcties per keuring toestaan ─────────────────────────
drop index if exists public.inspections_corrects_unique;
-- (inspections_corrects_inspection_id_idx uit 20260917 blijft: gewone index.)

-- ─── B. correct_inspection: alleen de gewijzigde items ───────────────────
create or replace function public.correct_inspection(
  p_inspection_id uuid,
  p_items jsonb  -- [{item_id, result, rejection_code_id, comment, next_due}, ...] -- alleen gewijzigde
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_original public.inspections;
  v_inspector_id uuid;
  v_new_id uuid;
  v_root_id uuid;
  v_walk uuid;
  v_parent uuid;
  v_family_count integer;
  v_base_number text;
  v_new_number text;
  v_item_count integer;
  v_valid_count integer;
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

  -- Minstens één item, en elk item moet bij déze keuring horen.
  v_item_count := coalesce(jsonb_array_length(p_items), 0);
  if v_item_count = 0 then
    raise exception 'Geen gewijzigde artikelen om te corrigeren.';
  end if;
  select count(distinct oi.id) into v_valid_count
  from jsonb_array_elements(p_items) e
  join public.inspection_items oi
    on oi.id = (e->>'item_id')::uuid and oi.inspection_id = p_inspection_id;
  if v_valid_count <> v_item_count then
    raise exception 'Een of meer artikelen horen niet bij deze keuring (of staan er dubbel in).';
  end if;

  -- Een artikel dat vanaf deze keuring al gecorrigeerd is, niet nog eens
  -- vanaf hier corrigeren: dat moet vanaf het nieuwere certificaat.
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    join public.inspection_items oi on oi.id = (e->>'item_id')::uuid
    join public.inspections c on c.corrects_inspection_id = p_inspection_id
    join public.inspection_items ci on ci.inspection_id = c.id and ci.article_id = oi.article_id
  ) then
    raise exception 'Een of meer artikelen zijn al gecorrigeerd. Corrigeer ze vanaf het nieuwste certificaat.';
  end if;

  -- Oorsprong van de familie opzoeken (voor het basisnummer).
  v_walk := p_inspection_id;
  loop
    select corrects_inspection_id into v_parent from public.inspections where id = v_walk;
    exit when v_parent is null;
    v_walk := v_parent;
  end loop;
  v_root_id := v_walk;

  select number into v_base_number from public.certificates where inspection_id = v_root_id;
  if v_base_number is null then
    raise exception 'Geen certificaat gevonden voor de oorspronkelijke keuring.';
  end if;

  -- Volgende vrije letter binnen de hele familie (alle correcties die,
  -- direct of via een andere correctie, van de oorsprong afstammen).
  with recursive family as (
    select id from public.inspections where corrects_inspection_id = v_root_id
    union all
    select i.id from public.inspections i join family f on i.corrects_inspection_id = f.id
  )
  select count(*) into v_family_count from family;
  -- Boven de 26e correctie loopt de letter door voorbij 'z' (zeer
  -- onwaarschijnlijk in de praktijk, bewust niet verder afgehandeld).
  v_new_number := v_base_number || '-' || chr(97 + v_family_count);

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

  -- Alleen de meegegeven items. `ov ? 'x'` onderscheidt "veld bewust
  -- geleegd" van "veld niet meegegeven" (zie 20260917).
  insert into public.inspection_items (
    inspection_id, article_id, article_snapshot, result, next_due, rejection_code_id, comment, inspector_id
  )
  select
    v_new_id,
    oi.article_id,
    oi.article_snapshot,
    case when ov ? 'result' then ov->>'result' else oi.result end,
    case when ov ? 'next_due' then nullif(ov->>'next_due', '')::date else oi.next_due end,
    case when ov ? 'rejection_code_id' then nullif(ov->>'rejection_code_id', '')::uuid else oi.rejection_code_id end,
    case when ov ? 'comment' then ov->>'comment' else oi.comment end,
    v_inspector_id
  from jsonb_array_elements(p_items) ov
  join public.inspection_items oi
    on oi.id = (ov->>'item_id')::uuid and oi.inspection_id = p_inspection_id;

  return v_new_id;
end;
$function$;

grant execute on function public.correct_inspection(uuid, jsonb) to authenticated;

-- ─── C. verify_certificate: per artikel "gecorrigeerd, zie X" ────────────
-- Identiek aan 20260917, behalve: superseded_by altijd null, nieuw
-- 'corrects' bovenaan en 'corrected_by' per item.
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
    'superseded_by', null,
    'corrects', (
      select jsonb_build_object('number', pc.number, 'verify_token', pc.verify_token)
      from certificates pc
      where pc.inspection_id = i.corrects_inspection_id
    ),
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
        'next_due', ii.next_due,
        'corrected_by', (
          select jsonb_build_object('number', c2.number, 'verify_token', c2.verify_token)
          from inspections i2
          join inspection_items ii2 on ii2.inspection_id = i2.id and ii2.article_id = ii.article_id
          join certificates c2 on c2.inspection_id = i2.id
          where i2.corrects_inspection_id = i.id
          order by i2.completed_at desc
          limit 1
        )
      ))
      from inspection_items ii
      left join articles a on a.id = ii.article_id
      cross join lateral (
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
