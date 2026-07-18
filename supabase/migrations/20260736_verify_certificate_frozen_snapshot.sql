-- Code review 2026-07-18, punt 7: "bevroren op keurmoment" was niet echt
-- bevroren. inspection_items.article_snapshot bestaat precies hiervoor (de
-- volledige artikelrij zoals die was toen de keuring startte), maar de
-- verify-RPC las LIVE artikeldata. Wijzigde iemand later het serienummer of
-- de omschrijving van een artikel, dan toonde de verificatiepagina iets
-- anders dan het uitgegeven PDF.
--
-- Hier: snapshot eerst, live artikel alleen als vangnet voor oude items van
-- vóór de snapshot-kolom. Het product (merk/naam) joinen we via het
-- product_id UIT de snapshot -- ook als het artikel later aan een ander
-- product gekoppeld wordt, blijft het historische label kloppen.
-- Gedrag verder identiek aan 20260722 (not_assessed blijft weggelaten).

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
  where c.verify_token = token;

  return result;
end;
$function$;
