-- Type keuring per keuringsregel (LOLER 1998, Schedule 1 §6/§7).
--
-- Jos, 2026-10-02: niet per artikel maar per keuringsregel, zodat de historie
-- klopt -- "na een val" geldt voor déze keuring, de volgende is gewoon weer
-- periodiek. Vervangt het vrije tekstveld articles.free_exam_type (die kolom
-- blijft bestaan als vangnet voor oude certificaten, maar wordt niet meer
-- gevuld).
--
--   first        = First thorough examination (vóór eerste gebruik / na installatie)
--   periodic     = Within an interval of 6/12 months (termijn volgt uit het type)
--   scheme       = In accordance with an examination scheme (eigen termijn)
--   exceptional  = After the occurrence of exceptional circumstances
--
-- Leeg = oude regel van vóór deze migratie; het certificaat behandelt die als
-- periodiek (of toont articles.free_exam_type als die gevuld was).

alter table public.inspection_items
  add column if not exists exam_type text,
  add column if not exists exam_interval_months integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inspection_items_exam_type_check'
  ) then
    alter table public.inspection_items
      add constraint inspection_items_exam_type_check
      check (exam_type is null or exam_type in ('first', 'periodic', 'scheme', 'exceptional'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'inspection_items_exam_interval_months_check'
  ) then
    alter table public.inspection_items
      add constraint inspection_items_exam_interval_months_check
      check (exam_interval_months is null or exam_interval_months between 1 and 120);
  end if;
end $$;
