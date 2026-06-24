-- Certificaat-PDF (DATAMODEL §certificates, bouwplan fase 2). Een PDF wordt
-- één keer gegenereerd bij het afronden van een keuring en daarna nooit meer
-- aangepast (`storage_path`/`pdf_hash` zijn het audit-bewijs); de
-- verificatie-QR op de PDF wijst naar `/verify/:verify_token`, publiek
-- bereikbaar zonder account.
--
-- Bedrijfsvelden voor de PDF-kop/voet (DATAMODEL §inspection_companies) waren
-- nog niet aangelegd — leeg blijft prima, de PDF valt dan terug op een kale
-- juridische standaardtekst (zie apps/inspector certificate-generator).

alter table public.inspection_companies
  add column if not exists address      text,
  add column if not exists postal_code  text,
  add column if not exists city         text,
  add column if not exists email        text,
  add column if not exists phone        text,
  add column if not exists cert_header  text,
  add column if not exists cert_footer  text;

create table if not exists public.certificates (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null unique references public.inspections(id),
  number        text not null,
  storage_path  text not null,
  language      text not null default 'nl',
  issued_at     timestamptz not null default now(),
  pdf_hash      text not null,
  verify_token  text not null unique,
  created_at    timestamptz not null default now()
);

create index if not exists certificates_verify_token_idx on public.certificates(verify_token);

grant select, insert on public.certificates to authenticated;

-- Publieke verificatie-bucket: pad is een ongokbare uuid, zelfde
-- vertrouwensmodel als de verify_token in de URL. "public" laat
-- storage.objects-select zonder account toe; alleen authenticated mag
-- uploaden.
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', true)
on conflict (id) do nothing;

drop policy if exists "certificates upload by authenticated" on storage.objects;

create policy "certificates upload by authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'certificates');

-- Beperkte, publieke kijk op een certificaat voor de verificatiepagina (scan
-- QR → bewijs dat het record echt is) zonder de volledige klant-/keuringdata
-- aan anonieme gebruikers te geven. security definer omdat anon geen rechten
-- heeft op customers/inspections/inspection_items.
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

grant execute on function public.verify_certificate(text) to anon, authenticated;
