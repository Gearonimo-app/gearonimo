-- Afvoeren was sinds 20260712 toegestaan voor elk actief lid ("Verruiming
-- na feedback Jos 2026-07-02"). Jos draait dat nu terug (2026-07-13): alleen
-- de klant-beheerder mag materiaal afvoeren, niet elke medewerker. Zelfde
-- is_admin-check als update_my_article, serverside afgedwongen -- niet
-- alleen de knop verbergen in de app, anders kan de RPC nog steeds
-- rechtstreeks aangeroepen worden.

create or replace function public.retire_my_article(p_article_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_is_admin boolean;
begin
  select m.customer_id, m.is_admin into v_customer, v_is_admin
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if not coalesce(v_is_admin, false) then
    raise exception 'Alleen een beheerder mag materiaal afvoeren.';
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
