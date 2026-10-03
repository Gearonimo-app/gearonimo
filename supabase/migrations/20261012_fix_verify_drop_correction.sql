-- HERSTEL (2026-10-03): QR-pagina werkte niet meer, correctiefunctie weer weg.
--
-- Fout van Claude: 20261008 en 20261009 gingen uit van 20260917 als laatste
-- versie, op volgorde van bestandsnaam. Maar 20260766_remove_correction is
-- LATER gemaakt (24 sept., na 20260917 van 16 sept.) en haalde de correctie-
-- route bewust weg (besluit Jos: "ik vind het ook fijn als er geen onnodige
-- code in staat"), inclusief de kolom inspections.corrects_inspection_id.
-- Gevolg:
--   - verify_certificate() uit 20261008 verwees naar die verdwenen kolom →
--     de QR-pagina gaf voor iedereen een fout ("column i2.corrects_inspection_id
--     does not exist"). Ontdekt bij de eerste echte test in de live app.
--   - 20261009 zette correct_inspection() terug, die Jos had laten weghalen.
--
-- Hier: verify_certificate = de versie van 20260766 (zonder "vervangen door")
-- + het afgevoerd-filter van 20261008; correct_inspection weer weg.
-- Les: de volgorde van migraties is de git-datum, niet de bestandsnaam.
--
-- Idempotent.

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
        -- Afgevoerd (volgens de momentopname) zonder afkeuring: weg (20261008).
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

drop function if exists public.correct_inspection(uuid, jsonb);
