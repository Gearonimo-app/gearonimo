-- Momentopname bij afronden + afgevoerd valt van het certificaat (Jos,
-- 2026-10-03).
--
-- A. inspection_items.article_snapshot werd alleen gezet bij het TOEVOEGEN
--    van een artikel aan de keuring. Een correctie in de tabel daarna
--    (serienummer, bouwjaar, gebruiker) kwam daardoor niet op het
--    certificaat: dat leest de momentopname. Nu ververst de app de
--    momentopname vlak vóór het certificaat (en vóór de Excel-export) via
--    refresh_inspection_snapshots(). Alleen zolang de keuring nog niet is
--    afgerond -- de bestaande trigger inspection_items_block_completed_mutation
--    houdt een afgeronde keuring onveranderlijk, ook voor deze functie.
--
-- B. Afgevoerd (articles.retired) zonder afkeuring hoort niet op het
--    certificaat, niet in Excel en niet op de QR-pagina. Afgekeurd én
--    afgevoerd blijft er wél op (LOLER Schedule 1 §8: elk gevonden gebrek
--    staat op het rapport). Er wordt gekeken naar `retired` IN de
--    momentopname, niet naar het live artikel: een karabiner die over een
--    jaar wordt afgevoerd mag niet van de QR-pagina van een oud certificaat
--    verdwijnen. Oude regels zonder momentopname blijven zoals ze waren.
--
-- Idempotent: create or replace.

-- ─── A. Momentopname verversen ───────────────────────────────────────────
-- security invoker (standaard): de RLS-policies van de aanroepende
-- keurmeester gelden gewoon, net als bij elke andere opslag uit de app.
create or replace function public.refresh_inspection_snapshots(p_inspection_id uuid)
returns integer
language plpgsql
security invoker
set search_path = public
as $function$
declare
  n integer;
begin
  update inspection_items ii
     set article_snapshot = to_jsonb(a)
    from articles a
   where a.id = ii.article_id
     and ii.inspection_id = p_inspection_id;
  get diagnostics n = row_count;
  return n;
end;
$function$;

grant execute on function public.refresh_inspection_snapshots(uuid) to authenticated;

-- ─── B. QR-pagina: afgevoerd zonder afkeuring weglaten ───────────────────
-- Identiek aan 20260917 (D), alleen de where-regel van 'items' is uitgebreid.
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
        -- Afgevoerd (volgens de momentopname) zonder afkeuring: weg.
        and not (
          coalesce((ii.article_snapshot->>'retired')::boolean, false)
          and ii.result <> 'rejected'
        )
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
