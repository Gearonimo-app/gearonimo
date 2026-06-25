-- Recall-vlag/link voor vrije (niet-catalogus) artikelen, en defensief de
-- handleiding-link op producten (werd al geselecteerd/gebruikt maar bestond
-- nog niet zeker als kolom in elke omgeving).

alter table public.articles
  add column if not exists free_recall_flag boolean not null default false,
  add column if not exists free_recall_url text;

alter table public.products
  add column if not exists manual_url text;
