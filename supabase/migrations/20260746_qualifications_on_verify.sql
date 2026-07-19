-- Kwalificaties van de keurmeester doorklikbaar via de certificaat-QR
-- (besluit Jos 2026-07-19: NIET op het certificaat-PDF zelf, wél
-- doorklikbaar naar de kwalificatie-PDF's).
--
-- Privacy-opzet: de qualifications-bucket blijft privé (diploma's =
-- gevoelige documenten, besluit 20260629). Per kwalificatie komt er een
-- expliciete "zichtbaar bij verificatie"-schakelaar in Instellingen ->
-- Keurmeesters: aanzetten kopieert het bestand naar de PUBLIEKE
-- branding-bucket ({company_id}/qualifications/...) en zet public_path;
-- uitzetten verwijdert die kopie weer. Alleen bewust gedeelde documenten
-- zijn dus openbaar -- de verify-RPC toont alleen kwalificaties mét
-- public_path (naam/nummer/geldig-tot van niet-gedeelde kwalificaties
-- blijven ook onzichtbaar).

alter table public.inspector_qualifications
  add column if not exists public_path text;

-- verify_certificate: identiek aan 20260736, plus inspector_name en de
-- gedeelde kwalificaties.
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
