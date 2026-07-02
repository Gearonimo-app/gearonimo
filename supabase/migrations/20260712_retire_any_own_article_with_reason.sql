-- Verruiming na feedback Jos (2026-07-02): de klant mag ELK eigen artikel
-- afvoeren -- niet alleen afgekeurd materiaal, ook bij verlies of diefstal.
-- Daarbij wordt nu een reden vastgelegd (retired_reason), zodat de
-- keurmeester bij het SN-zoeken tijdens een keuring ziet: "Afgevoerd
-- (gestolen)" i.p.v. een spoorloos artikel. De rejected-only-check uit
-- 20260711 vervalt dus bewust.

alter table public.articles
  add column if not exists retired_reason text;

-- Oude signatuur (alleen p_article_id) opruimen, anders blijven er twee
-- overloads bestaan.
drop function if exists public.retire_my_article(uuid);

create or replace function public.retire_my_article(p_article_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.customer_id = v_customer and a.retired = false
  ) then
    raise exception 'Artikel niet gevonden bij jouw bedrijf.';
  end if;

  update public.articles
  set retired = true,
      retired_at = now(),
      retired_reason = nullif(trim(coalesce(p_reason, '')), '')
  where id = p_article_id;
end;
$$;

grant execute on function public.retire_my_article(uuid, text) to authenticated;
