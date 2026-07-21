-- no_ppe was already documented (DATAMODEL.md, i18n-keys) as a product_type
-- maar stond niet in de check-constraint. Toegevoegd zodat database en
-- documentatie/code weer matchen.
alter table public.products
  drop constraint if exists products_product_type_check;

alter table public.products
  add constraint products_product_type_check
  check (product_type = any (array['ppe'::text, 'no_ppe'::text, 'rigging'::text, 'aerial_platform'::text, 'machine'::text, 'other'::text]));
