-- Code review (midden-bevinding): apps/customer/src/components/AddPartForm.vue
-- riep add_my_article() en get_or_create_article_set() na elkaar aan. Mislukte
-- de tweede (netwerk weg, validatiefout), dan bleef het net aangemaakte
-- artikel bestaan maar ongekoppeld -- een wees-artikel.
--
-- Beide bestaande functies blijven ongewijzigd (ook los bruikbaar); deze
-- nieuwe functie roept ze allebei aan binnen ÉÉN functie-aanroep, dus binnen
-- één transactie: faalt de koppelstap, dan rolt de net aangemaakte
-- artikelrij vanzelf ook terug. Geen gedupliceerde logica.

create or replace function public.add_and_link_my_article(
  p_product_id uuid default null,
  p_free_brand text default null,
  p_free_category text default null,
  p_free_description text default null,
  p_serial_number text default null,
  p_assigned_user_name text default null,
  p_manufacture_year int default null,
  p_manufacture_month int default null,
  p_first_use_date date default null,
  p_purchase_date date default null,
  p_free_product_type text default null,
  p_customer_id uuid default null,
  p_primary_article_id uuid default null,
  p_primary_label text default null,
  p_role text default null,
  p_retire_article_id uuid default null,
  p_retire_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_article_id uuid;
begin
  v_new_article_id := public.add_my_article(
    p_product_id, p_free_brand, p_free_category, p_free_description,
    p_serial_number, p_assigned_user_name, p_manufacture_year, p_manufacture_month,
    p_first_use_date, p_purchase_date, p_free_product_type
  );

  perform public.get_or_create_article_set(
    p_customer_id, p_primary_article_id, p_primary_label, v_new_article_id,
    p_role, p_retire_article_id, p_retire_reason
  );

  return v_new_article_id;
end;
$$;

grant execute on function public.add_and_link_my_article(
  uuid, text, text, text, text, text, int, int, date, date, text, uuid, uuid, text, text, uuid, text
) to authenticated;
