-- Extra bedrijfsvelden voor het certificaat (wens Jos 2026-06-26):
-- provincie (niet relevant in NL, wél bv. in Canada) en optionele KvK-/
-- BTW-nummers. De PDF toont ze alleen als ze ingevuld zijn.
--
-- `registration_number` stond al in DATAMODEL §inspection_companies maar was nog
-- niet aangelegd; `vat_number`/`province` bestonden al wel op `customers`
-- (20260622_customers_extra_fields.sql) — hier hetzelfde voor het keurbedrijf.

alter table public.inspection_companies
  add column if not exists province            text,
  add column if not exists registration_number text,
  add column if not exists vat_number          text;
