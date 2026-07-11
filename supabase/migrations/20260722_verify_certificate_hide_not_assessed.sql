-- Fix (Jos-test, stap 33): het QR-verificatiescherm (VerifyCertificate.vue,
-- gevoed door deze RPC) toonde een NIET-beoordeeld artikel (result =
-- 'not_assessed') als AFGEKEURD. De PDF (useCertificate.ts, regel 777) laat
-- 'not_assessed'-items bewust helemaal weg uit het certificaat; deze RPC deed
-- dat niet en pakte alle inspection_items van de keuring. De frontend-template
-- rendert bovendien alles wat niet letterlijk 'passed' is als een rood
-- kruisje -- dus ook 'not_assessed' zag eruit als 'rejected'. Twee kanten van
-- dezelfde discrepantie; hier de RPC-kant gelijktrekken met de PDF.
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
          trim(coalesce(p.brand, '') || ' ' || coalesce(p.name, '')),
          trim(coalesce(a.free_brand, '') || ' ' || coalesce(a.free_description, ''))
        ),
        'serial_number', a.serial_number,
        'result', ii.result,
        'next_due', ii.next_due
      ))
      from inspection_items ii
      left join articles a on a.id = ii.article_id
      left join products p on p.id = a.product_id
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
