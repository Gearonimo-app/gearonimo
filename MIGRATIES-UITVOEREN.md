# Migraties uitvoeren — stap voor stap (30 augustus 2026)

Er staan vier migraties open. De code staat live, maar de databasekant niet, en
daardoor werken een paar schermen niet goed. Deze handleiding loopt het helemaal
uit: wat je klikt, wat je plakt, wat je hoort te zien, en wat je doet als er iets
misgaat.

**Tijd:** ±10 minuten. **Nodig:** je Supabase-login. Verder niets.

---

## Wat er open staat en waarom het uitmaakt

| Migratie | Wat je merkt zonder deze migratie |
|---|---|
| `20260755_article_detail_self_checks` | Je vinkt in de klant-app een EHBO-koffer af, en het artikelscherm blijft "Nog niet gekeurd" tonen. |
| `20260756_article_detail_performed_by` | De naam die je bij een controle invult ("door wie?") komt nergens terug. |
| `20260757_products_unique_index` | Niets kapots, maar dezelfde combinatie merk + naam kan nog twee keer in de catalogus. |
| `20260748_platform_admin_set_password` | De knop "Wachtwoord instellen" in Bedrijven geeft een foutmelding. |

### Twee waarschuwingen vooraf

**1. De volgorde is echt belangrijk.** `20260756` herschrijft dezelfde
databasefunctie (`my_article_detail`) die `20260755` ook aanmaakt. Draai je ze in
de verkeerde volgorde, dan overschrijft de oude versie de nieuwe en is de naam
bij de controle stilletjes weer weg — precies de bug die 756 juist oplost. Je
krijgt daar geen foutmelding van; het werkt gewoon half.

Daarom staat hieronder route A: alles in één keer, in de goede volgorde. Dan kun
je die fout niet maken.

**2. Draai `20260749_catalog_reset_and_unique.sql` niet.** Dat bestand staat nog
in de map en oogt onschuldig ("idempotent" bovenaan), maar het koppelt élk
artikel los van zijn catalogusproduct en maakt daarna de hele catalogus leeg. Je
koppelwerk zou weg zijn. Het enige stuk dat nog nodig was — het slot op dubbele
producten — staat nu apart in `20260757`.

---

## Route A — alles in één keer (aanbevolen)

### Stap 1 — Supabase openen

Ga naar https://supabase.com/dashboard en log in. Kies het project
**`buitfeiclivzzldfdelp`**.

### Stap 2 — Naar de SQL-editor

Klik in de linkerbalk op **SQL Editor** (icoontje met `>_`). Klik bovenin op
**+ New query**. Je krijgt een leeg tekstvak.

### Stap 3 — Het bestand ophalen

Open in een nieuw browsertabblad:

```
https://github.com/Gearonimo-app/gearonimo/blob/main/supabase/UITVOEREN-2026-08-30.sql
```

Klik rechtsboven het bestand op de knop **Raw** (of het kopieer-icoontje). Zie je
de knop niet: klik op de drie puntjes → **Copy raw file**.

Selecteer alles (Ctrl+A / Cmd+A) en kopieer (Ctrl+C / Cmd+C).

> Dit bestand is een samenvoeging van de vier migraties in de juiste volgorde,
> gemaakt uit de echte bestanden — er is niets overgetypt.

### Stap 4 — Plakken en draaien

Plak alles in het lege tekstvak in de SQL-editor. Klik rechtsonder op **Run**
(of Ctrl+Enter / Cmd+Enter).

**Verwacht:** groene melding **Success. No rows returned**, na een paar seconden.

Onderin, bij **Messages** of in de resultaatbalk, hoor je ook een paar
`NOTICE`-regels te zien. Zoek deze:

```
Unieke index products_brand_name_uniq staat klaar.
```

**Zie je in plaats daarvan** `Let op: nog N dubbele merk+naam-combinaties in
products` — dan is alles behalve het slot gelukt. Geef mij dat getal door; dan
ruimen we die dubbelen eerst op en zetten we het slot daarna. De rest van het
testplan kun je gewoon doen.

### Stap 5 — Ga door naar stap 7 (controleren)

---

## Route B — één voor één (als route A niet lukt)

Doe ze in **precies deze volgorde**. Voor elk bestand: open het op GitHub, klik
**Raw**, kopieer alles, plak in een nieuwe query, klik **Run**, wacht op
`Success` en ga pas dan naar de volgende.

De bestanden staan in `https://github.com/Gearonimo-app/gearonimo/blob/main/supabase/migrations/`:

1. `20260755_article_detail_self_checks.sql` → **Verwacht:** Success
2. `20260756_article_detail_performed_by.sql` → **Verwacht:** Success
   ← **deze na 755, nooit ervoor**
3. `20260757_products_unique_index.sql` → **Verwacht:** Success + de
   NOTICE-regel uit stap 4
4. `20260748_platform_admin_set_password.sql` → **Verwacht:** Success

> Twijfel je halverwege of je de volgorde goed had? Draai `20260755` en
> `20260756` gewoon nog een keer achter elkaar. Ze zijn allebei idempotent en de
> laatste die draait wint — dus 755, dan 756, en het staat goed.

---

## Stap 6 — Even niets vergeten

Migratie `20260748` raakt de interne inlogtabel van Supabase (`auth.users`) om
een wachtwoord te kunnen zetten. Dat is normaal voor deze functie, maar test hem
straks in fase 7 van het testplan één keer op één account voordat je erop
vertrouwt: wachtwoord instellen → uitloggen → inloggen met e-mail + wachtwoord.

---

## Stap 7 — Controleren dat het gelukt is

Open een nieuwe query, plak dit, klik **Run**:

```sql
select
  -- Staan de vier functies er, en geeft de nieuwste versie de naam terug?
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_article_detail')                as fn_article_detail,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'my_articles')                      as fn_my_articles,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'platform_admin_set_inspector_password')                     as fn_set_password,
  -- Staat het slot op dubbele producten?
  (select count(*) from pg_indexes
    where tablename = 'products' and indexname = 'products_brand_name_uniq')       as slot_op_dubbelen,
  -- Ter info voor het testplan:
  (select count(*) from public.products)                                          as producten,
  (select count(*) from public.articles where product_id is not null)              as gekoppelde_artikelen;
```

**Verwacht:**

| kolom | waarde |
|---|---|
| `fn_article_detail` | **1** |
| `fn_my_articles` | **1** |
| `fn_set_password` | **1** |
| `slot_op_dubbelen` | **1** (of 0 als je de "nog N dubbelen"-melding kreeg) |
| `producten` | een paar duizend — schrijf dit getal op, je hebt het nodig bij fase 5 stap 56 |
| `gekoppelde_artikelen` | ongeveer wat je met de hand hebt gekoppeld |

### Staat de naam bij de controle er echt in?

Deze laatste controle bewijst dat 755 en 756 in de goede volgorde stonden:

```sql
select
  pg_get_function_result(p.oid) like '%self_performed_by%' as naam_zit_erin,
  pg_get_function_result(p.oid) like '%self_checked_at%'   as datum_zit_erin
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'my_article_detail';
```

**Verwacht:** één regel met **`true`** in beide kolommen.

Krijg je alleen `self_checked_at`, dan is 756 vóór 755 gedraaid. Oplossing: draai
`20260756_article_detail_performed_by.sql` nog één keer, en controleer opnieuw.

---

## Als er iets misgaat

**"permission denied for table ..."** — een tabel mist een `grant`. Stuur me de
volledige melding; dat is een bekend patroon hier en zo opgelost.

**"function ... already exists with same argument types"** — een `create
function` zonder `drop` ervoor. Kan bij deze vier niet gebeuren (ze droppen
allemaal eerst), maar als het toch komt: stuur de melding door.

**"violates foreign key constraint"** — meestal een FK die naar de lege tabel
`public.users` wijst in plaats van naar `auth.users`. Dat is hier al drie keer
gebeurd. Stuur de melding door, dan schrijf ik het reparatieregeltje.

**Rood, maar je weet niet meer wat je gedraaid had** — niet erg. Alle vier zijn
idempotent. Draai route A gewoon opnieuw, van boven naar beneden.

**Iets anders** — kopieer de hele rode melding en stuur hem door. Verzin niets
zelf in de SQL-editor; deze database heeft echte klantgegevens.

---

## Daarna

Ga terug naar **`TESTPLAN.md`**, fase 0b (schoon herstarten) en werk het plan van
daaruit door.
