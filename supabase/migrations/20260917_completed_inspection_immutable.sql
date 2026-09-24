-- Code review 15/16 sept. 2026, "hoog"-bevinding: een afgeronde keuring was
-- in de database niet echt onveranderlijk. verify_certificate() las het
-- resultaat live uit inspection_items, dus een gewijzigd 'passed'/'rejected'
-- na afronden zou gewoon op de publieke verificatiepagina verschijnen --
-- terwijl er niets aan het al uitgegeven PDF veranderde.
--
-- Besluit Jos (16 sept. 2026, na overleg): geen simpel "op slot, punt uit".
-- Wél volledig onveranderlijk zodra een keuring is afgerond, MAAR een
-- keurmeester moet fouten kunnen herstellen -- dat wordt dan een nieuw
-- certificaat met een lettersuffix (20260718-BOOMWERK, dan -a, -b, ...),
-- met de oorspronkelijke keuring/certificaat intact als audit-spoor. Wie het
-- oude (vervangen) certificaat scant, ziet "vervangen door X" + link.
-- Elke actieve keurmeester van het bedrijf mag corrigeren (zelfde rechten
-- als afronden zelf).
--
-- Uitzondering: een geïmporteerde keuring ongedaan maken
-- (deleteImportBatch, useImportCommit.ts) verwijdert ook al-"voltooide"
-- keuringen (geïmporteerde certificaten staan meteen op completed, en
-- hebben zelf geen certificate-PDF). Die flow blijft toegestaan -- bewuste
-- uitzondering (Jos: "ja, sta dit toe").
--
-- Certificaten zelf hebben deze uitzondering niet nodig: generateCertificate()
-- doet zijn delete+insert-regeneratie altijd VOORDAT de keuring op 'completed'
-- gezet wordt (zowel bij direct afronden als bij de offline-sync), dus die
-- bestaande flow blijft werken. Een geïmporteerde keuring krijgt sowieso nooit
-- een certificaat-rij.

-- ─── A. Schema: correctie-keten ──────────────────────────────────────────

alter table public.inspections
  add column if not exists corrects_inspection_id uuid references public.inspections(id);

-- Eén rechte keten, geen vertakkingen: een keuring kan maar door precies één
-- andere keuring gecorrigeerd worden.
drop index if exists inspections_corrects_unique;
create unique index inspections_corrects_unique
  on public.inspections(corrects_inspection_id)
  where corrects_inspection_id is not null;

create index if not exists inspections_corrects_inspection_id_idx
  on public.inspections(corrects_inspection_id);

-- ─── B. Onveranderlijkheid: triggers ─────────────────────────────────────

create or replace function public.block_completed_inspection_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'completed' and old.import_batch_id is null then
      raise exception 'Een afgeronde keuring kan niet verwijderd worden. Gebruik correct_inspection() om te corrigeren.';
    end if;
    return old;
  end if;

  if old.status = 'completed' then
    raise exception 'Een afgeronde keuring kan niet meer gewijzigd worden. Gebruik correct_inspection() om te corrigeren.';
  end if;
  return new;
end;
$$;

drop trigger if exists inspections_block_completed_mutation on public.inspections;
create trigger inspections_block_completed_mutation
  before update or delete on public.inspections
  for each row execute function public.block_completed_inspection_mutation();

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
    raise exception 'Items van een afgeronde keuring kunnen niet meer gewijzigd worden. Gebruik correct_inspection() om te corrigeren.';
  end if;
  return new;
end;
$$;

drop trigger if exists inspection_items_block_completed_mutation on public.inspection_items;
create trigger inspection_items_block_completed_mutation
  before update or delete on public.inspection_items
  for each row execute function public.block_completed_inspection_item_mutation();

-- certificates: geen import-uitzondering nodig (geïmporteerde keuringen
-- krijgen nooit een certificaatrij). generateCertificate() regenereert altijd
-- vóórdat de keuring op 'completed' staat, dus die flow blijft werken.
create or replace function public.block_completed_certificate_mutation()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status into v_status from public.inspections where id = old.inspection_id;
  if v_status = 'completed' then
    raise exception 'Het certificaat van een afgeronde keuring kan niet meer gewijzigd of verwijderd worden. Gebruik correct_inspection() om te corrigeren.';
  end if;
  return old;
end;
$$;

drop trigger if exists certificates_block_completed_mutation on public.certificates;
create trigger certificates_block_completed_mutation
  before update or delete on public.certificates
  for each row execute function public.block_completed_certificate_mutation();

-- ─── C. Corrigeren: nieuwe keuring + items, gekoppeld aan de oude ────────
-- Kloont de items van de afgeronde keuring naar een NIEUWE, zelf ook meteen
-- afgeronde keuring; p_items geeft per te wijzigen item de nieuwe waarden
-- (ontbrekende items blijven ongewijzigd overgenomen). De oude rijen worden
-- nooit aangeraakt -- dat is precies het punt.
create or replace function public.correct_inspection(
  p_inspection_id uuid,
  p_items jsonb  -- [{item_id, result, rejection_code_id, comment, next_due}, ...]
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
  from public.inspection_items oi
  left join lateral (
    select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) value
    where (value->>'item_id')::uuid = oi.id
    limit 1
  ) as x(ov) on true
  where oi.inspection_id = p_inspection_id;

  return v_new_id;
end;
$function$;

grant execute on function public.correct_inspection(uuid, jsonb) to authenticated;

-- ─── D. verify_certificate: "vervangen door" tonen ───────────────────────
-- Identiek aan 20260746, plus: is deze keuring gecorrigeerd (er bestaat een
-- keuring met corrects_inspection_id = deze), dan het nieuwe certificaat
-- meesturen zodat de verificatiepagina kan doorlinken.
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
    'superseded_by', (
      select jsonb_build_object('number', c2.number, 'verify_token', c2.verify_token)
      from inspections i2
      join certificates c2 on c2.inspection_id = i2.id
      where i2.corrects_inspection_id = i.id
      limit 1
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
        'next_due', ii.next_due
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
