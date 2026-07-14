-- Recall/inspection-notice-vlaggen kunnen straks per artikel "afgevinkt"
-- worden door de keurmeester (met een verplichte opmerking), zodat een
-- vlaggetje niet voor altijd blijft staan nadat het is beoordeeld -- bv.
-- "voldaan" of "dit exemplaar valt niet binnen de recall-batch" (Jos
-- 2026-07-14). De *_cleared_url bewaart welke link is afgevinkt: verandert
-- products.recall_url/inspection_notice_url later naar een nieuwe link (een
-- volgende recall), dan geldt de oude afvinking niet meer en verschijnt de
-- vlag opnieuw.
alter table public.articles
  add column if not exists recall_cleared_url  text,
  add column if not exists recall_cleared_note text,
  add column if not exists recall_cleared_at   timestamptz,
  add column if not exists notice_cleared_url  text,
  add column if not exists notice_cleared_note text,
  add column if not exists notice_cleared_at   timestamptz;
