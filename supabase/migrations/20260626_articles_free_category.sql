-- Categorie voor vrije artikelen (helm, harnas, klimlijn, karabijnhaak, …).
-- Catalogus-artikelen erven hun categorie van products.category; vrije
-- artikelen hadden nog geen categorieveld, terwijl de keuringstabel nu een
-- categoriekolom toont en de keurmeester de categorie wil kunnen kiezen.
alter table public.articles add column if not exists free_category text;
