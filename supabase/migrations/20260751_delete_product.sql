-- Catalogusproduct verwijderen vanuit de app, zonder SQL-editor.
--
-- Wens Jos (2026-07-29): "ik wil zonder sql kunnen werken in de toekomst".
-- Verwijderen was tot nu toe bewust geblokkeerd (zie 20260715): een product
-- dat aan artikelen hangt wordt door de FK tegengehouden. Besluit Jos: die
-- artikelen moeten gewoon blijven bestaan als vrij artikel — geen aparte stap
-- vooraf, wél een waarschuwing met het aantal.
--
-- Daarom een security definer-functie i.p.v. een delete-policy op de tabel:
-- het ontkoppelen raakt artikelen van álle keurbedrijven die dit product
-- gebruiken, en die mag de curator via RLS niet rechtstreeks bijwerken. In één
-- functie blijft het bovendien één transactie: nooit een half ontkoppelde
-- catalogus. Idempotent.

-- Hoeveel artikelen hangen aan dit product? Voor de waarschuwing vóór het
-- verwijderen — telt bewust over alle bedrijven heen, want dat is ook wat er
-- straks ontkoppeld wordt.
create or replace function public.product_usage_count(p_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_catalog_curator() then
    raise exception 'Alleen een catalogusbeheerder mag dit opvragen.';
  end if;
  select count(*) into n from public.articles a where a.product_id = p_id;
  return n;
end;
$$;

grant execute on function public.product_usage_count(uuid) to authenticated;

-- Verwijdert het product en ontkoppelt de artikelen die eraan hingen. Merk,
-- naam en categorie blijven als vrije tekst op het artikel staan, anders houd
-- je een artikel zonder omschrijving over. Geeft terug hoeveel artikelen zijn
-- losgemaakt.
create or replace function public.delete_product(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_catalog_curator() then
    raise exception 'Alleen een catalogusbeheerder mag een product verwijderen.';
  end if;

  update public.articles a
  set
    free_brand       = coalesce(nullif(btrim(a.free_brand), ''), p.brand),
    free_description = coalesce(nullif(btrim(a.free_description), ''), p.name),
    free_category    = coalesce(nullif(btrim(a.free_category), ''), p.category),
    product_id       = null
  from public.products p
  where a.product_id = p.id and p.id = p_id;
  get diagnostics n = row_count;

  delete from public.products where id = p_id;
  return n;
end;
$$;

grant execute on function public.delete_product(uuid) to authenticated;
