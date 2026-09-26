-- Eigenaar van een artikel = een gebruiker op de lijst, niet een losse naam
-- (besluit Jos 2026-09-26, BOUWPLAN "Besluit: klantrollen, eigenaar per
-- artikel, inloggen", stap 1).
--
-- Tot nu toe stond de gebruiker van een artikel alleen als tekst in
-- articles.assigned_user_name. "Piet" en "piet" waren twee mensen, een
-- naamswijziging bleef op de oude naam hangen, en een mail "alleen over je
-- eigen spullen" (stap 4) kon nergens aan vastgemaakt worden.
--
-- Nu: articles.assigned_member_id wijst naar customer_members. De lijst heet
-- in de app "Gebruikers" en mag ook "Voorraad" of "Reserve set 2" bevatten:
-- wie geen account heeft krijgt geen mail, die gaat naar de beheerder.
--
-- Eén bron, alle schrijfroutes: de koppeling gebeurt in een trigger op
-- articles, niet in de apps. Zo werken de keurmeester-app (directe insert/
-- update, ook offline-sync), de klant-app (add_my_article/update_my_article),
-- de import en de keuring-wizard allemaal zonder aanpassing:
--   * Wordt assigned_user_name gezet of gewijzigd, dan zoekt de trigger de
--     gebruiker met die naam bij dezelfde klant (hoofdletters en dubbele
--     spaties tellen niet) en maakt hem aan als hij nog niet bestaat.
--     De opgeslagen naam wordt de naam zoals hij op de lijst staat.
--   * Wordt een gebruiker hernoemd, dan volgen zijn artikelen.
--   * Wordt een gebruiker verwijderd, dan blijft de naam op het artikel
--     staan (geen data kwijt), alleen de koppeling vervalt.
-- assigned_user_name blijft dus bestaan als weergavenaam; alle bestaande
-- lees-RPC's blijven ongewijzigd werken.
--
-- Idempotent. Nog uit te voeren door Jos in de Supabase SQL-editor.

-- ─── 0. Naam-normalisatie ───────────────────────────────────────────────────
create or replace function public.member_name_key(p_name text)
returns text
language sql immutable
as $$
  select lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- ─── 1. Opruimen + foreign key ──────────────────────────────────────────────
-- De kolom bestond al (20260623) maar werd nooit gevuld; eventuele losse
-- waarden die nergens naar wijzen eerst leeg, anders faalt de FK.
update public.articles a
set assigned_member_id = null
where a.assigned_member_id is not null
  and not exists (
    select 1 from public.customer_members m
    where m.id = a.assigned_member_id and m.customer_id = a.customer_id
  );

alter table public.articles
  drop constraint if exists articles_assigned_member_id_fkey;
alter table public.articles
  add constraint articles_assigned_member_id_fkey
  foreign key (assigned_member_id) references public.customer_members(id)
  on delete set null;

create index if not exists articles_assigned_member_id_idx
  on public.articles(assigned_member_id);

-- ─── 2. Gebruiker zoeken of aanmaken ────────────────────────────────────────
-- p_prefer: de huidige koppeling. Heeft die (na hernoemen) dezelfde naam,
-- dan blijft hij staan, ook als er toevallig een tweede gebruiker met die
-- naam is. Verder: actieve gebruiker vóór inactieve, oudste eerst.
create or replace function public.resolve_article_member(
  p_customer_id uuid, p_name text, p_prefer uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key  text := public.member_name_key(p_name);
  v_id   uuid;
begin
  if v_key = '' or p_customer_id is null then
    return null;
  end if;

  if p_prefer is not null then
    select m.id into v_id
    from public.customer_members m
    where m.id = p_prefer
      and m.customer_id = p_customer_id
      and public.member_name_key(m.name) = v_key;
    if v_id is not null then
      return v_id;
    end if;
  end if;

  -- Twee gelijktijdige opslagen met dezelfde nieuwe naam mogen niet twee
  -- gebruikers opleveren: per klant één tegelijk.
  perform pg_advisory_xact_lock(hashtext('article_member:' || p_customer_id::text));

  select m.id into v_id
  from public.customer_members m
  where m.customer_id = p_customer_id
    and public.member_name_key(m.name) = v_key
  order by m.active desc, m.created_at
  limit 1;

  if v_id is null then
    insert into public.customer_members (customer_id, name, active)
    values (p_customer_id, regexp_replace(btrim(p_name), '\s+', ' ', 'g'), true)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

-- ─── 3. Trigger op articles ─────────────────────────────────────────────────
create or replace function public.articles_sync_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_name_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_name_changed := true;
  else
    v_name_changed := new.assigned_user_name is distinct from old.assigned_user_name
                   or new.customer_id is distinct from old.customer_id;
  end if;

  if v_name_changed then
    -- De naam is leidend.
    new.assigned_user_name := nullif(btrim(new.assigned_user_name), '');
    if new.assigned_user_name is null then
      if tg_op = 'INSERT' and new.assigned_member_id is not null then
        -- Nieuw artikel met alleen een gebruiker-id: naam erbij zoeken.
        select m.name into v_name
        from public.customer_members m
        where m.id = new.assigned_member_id and m.customer_id = new.customer_id;
        new.assigned_user_name := v_name;
        if v_name is null then
          new.assigned_member_id := null;
        end if;
      else
        new.assigned_member_id := null;
      end if;
    else
      new.assigned_member_id := public.resolve_article_member(
        new.customer_id,
        new.assigned_user_name,
        case when tg_op = 'UPDATE' then old.assigned_member_id end
      );
      select m.name into new.assigned_user_name
      from public.customer_members m
      where m.id = new.assigned_member_id;
    end if;

  elsif new.assigned_member_id is distinct from old.assigned_member_id then
    -- Alleen de koppeling wijzigt.
    if new.assigned_member_id is not null then
      select m.name into v_name
      from public.customer_members m
      where m.id = new.assigned_member_id and m.customer_id = new.customer_id;
      if v_name is null then
        raise exception 'Deze gebruiker hoort niet bij deze klant.';
      end if;
      new.assigned_user_name := v_name;
    end if;
    -- Naar null (gebruiker verwijderd, on delete set null): de naam blijft
    -- als tekst staan.
  end if;

  return new;
end;
$$;

drop trigger if exists articles_sync_owner on public.articles;
create trigger articles_sync_owner
  before insert or update on public.articles
  for each row execute function public.articles_sync_owner();

-- ─── 4. Hernoemen van een gebruiker: artikelen volgen ───────────────────────
create or replace function public.customer_members_rename_articles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.articles a
  set assigned_user_name = new.name
  where a.assigned_member_id = new.id
    and a.assigned_user_name is distinct from new.name;
  return null;
end;
$$;

drop trigger if exists customer_members_rename_articles on public.customer_members;
create trigger customer_members_rename_articles
  after update of name on public.customer_members
  for each row
  when (old.name is distinct from new.name)
  execute function public.customer_members_rename_articles();

-- ─── 5. Bestaande artikelen koppelen ────────────────────────────────────────
-- Zelfde regel als de trigger: bestaande naam -> bestaande gebruiker,
-- onbekende naam -> nieuwe gebruiker (zonder account) op de lijst.
update public.articles a
set assigned_member_id = public.resolve_article_member(a.customer_id, a.assigned_user_name, null)
where a.assigned_member_id is null
  and public.member_name_key(a.assigned_user_name) <> '';
