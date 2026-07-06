# Testplan Gearonimo — A tot Z (opgesteld 2026-07-06)

Volledige doorloop van het hele programma vanaf een schone lei. Doe het **stap
voor stap** en noteer per stap of het goed gaat (✅) of niet (❌ + wat je ziet).
Elke stap heeft een **Verwacht:**-regel zodat je meteen kunt vergelijken.

- **Pro-app (keurmeester):** https://gearonimo.net
- **Klant-app:** https://gearonimo.net/portal/
- **Supabase:** dashboard → project `buitfeiclivzzldfdelp` → SQL editor / Authentication.

> Tip: houd de Supabase SQL-editor open in een apart tabblad; een paar stappen
> vragen om een klein SQL-commando of een controle-query.

---

## Fase A — Schone lei (reset)

1. Supabase → SQL editor → plak de inhoud van `supabase/testdata-reset.sql` en **Run**.
   **Verwacht:** `Success`. (Je wordt hierna uitgelogd omdat álle accounts weg zijn.)
2. Draai de controle-query onderaan dat bestand.
   **Verwacht:** `customers`, `articles`, `inspections`, `inspectors`, `requests`, `users` = **0**; `products_KEEP` > 0; `companies_KEEP` = 1.
3. Supabase → Authentication → Users.
   **Verwacht:** lege lijst (geen accounts meer).
4. SQL: `select name, listed, latitude, longitude from public.inspection_companies;`
   **Verwacht:** Safety Green B.V., `listed = true`, latitude ≈ 51.92, longitude ≈ 5.84.

## Fase B — Keurmeester-account aanmaken

5. Supabase → Authentication → **Add user** → **Create new user**: e-mail `keurmeester@test.nl`, kies een wachtwoord, **Auto Confirm User** aan. Aanmaken.
   **Verwacht:** account verschijnt in de lijst.
6. Open https://gearonimo.net → log in met `keurmeester@test.nl` + wachtwoord.
   **Verwacht:** je komt op het **hoofdmenu** met tegels.
7. Bekijk de tegels.
   **Verwacht:** Keuringen, Klanten, **Aanvragen**, Offline downloads, (zoekbalk) en Instellingen. (Nog géén Catalogus-tegel — dat is de curator.)
8. SQL-controle: `select user_id, company_id, active, is_admin, can_curate_catalog from public.inspectors;`
   **Verwacht:** één rij, `active = true`, gekoppeld aan Safety Green (ensure_inspector heeft 'm automatisch aangemaakt).
9. Maak dit account meteen admin + catalogus-curator (voor de latere fases). SQL:
   ```sql
   update public.inspectors
   set is_admin = true, can_curate_catalog = true
   where user_id = (select id from auth.users where email = 'keurmeester@test.nl');
   ```
   **Verwacht:** `Success. 1 row`.
10. Ga terug naar de Pro-app en **herlaad** (F5).
    **Verwacht:** app opent normaal, nog steeds op het hoofdmenu.

## Fase C — Bedrijfsinstellingen

11. Instellingen (⚙️) openen.
    **Verwacht:** lijst met onderdelen: Afkeurcodes, Certificaat-template, Keurmeesters, **Vindbaarheid**, Excel/CSV-import, **Catalogus** (die laatste alleen omdat je nu curator bent).
12. Instellingen → **Afkeurcodes**.
    **Verwacht:** 8 codes (slijtage, mechanisch beschadigd, brand/smelt, roest, leeftijd/label, defecte sluiting, modificatie, anders). Voeg er testhalve één toe en zet 'm weer uit.
13. Instellingen → **Certificaat-template**.
    **Verwacht:** bedrijfsgegevens van Safety Green ingevuld, live PDF-preview rechts. Wijzig de accentkleur en zie de preview meebewegen. (Niet per se opslaan.)
14. Instellingen → **Keurmeesters**.
    **Verwacht:** jouw keurmeester in de lijst. Open 'm, upload een **handtekening** (PNG/JPG), sla op.
15. Instellingen → **Vindbaarheid**.
    **Verwacht:** schakelaar "Open voor nieuwe klanten" **aan**, latitude/longitude gevuld (Elst). Laat aan staan, ga terug.

## Fase D — Klant + artikelen (Pro-app)

16. Hoofdmenu → **Klanten** → nieuwe klant toevoegen. Vul naam (bv. "Klimvereniging De Rots"), adres, e-mail. Opslaan.
    **Verwacht:** klant verschijnt in de lijst, je komt op het klantdetail.
17. Op het klantdetail: zoek de **uitnodigingscode** (8 tekens). Noteer 'm — code **KLANT-1**.
    **Verwacht:** code zichtbaar en kopieerbaar.
18. SQL-controle: `select c.name, cl.status from customer_links cl join customers c on c.id = cl.customer_id;`
    **Verwacht:** de klant is automatisch **active** gekoppeld aan Safety Green (de herziene trigger koppelt aan jouw bedrijf).
19. Klant-detail → artikel toevoegen → typ een **bestaand catalogusproduct** (merk/naam die in de catalogus staat). Kies de suggestie. Vul serienummer + gebruiker. Opslaan.
    **Verwacht:** artikel toegevoegd, gekoppeld aan het catalogusproduct (geen "vrij"-badge).
20. Artikel toevoegen → typ een **onbekend product** (merk/omschrijving die níét in de catalogus staat), serienummer, bouwjaar. Opslaan.
    **Verwacht:** artikel toegevoegd met een **"vrij"-badge**.

## Fase E — Catalogus-aanmelding (TAAK 1)

21. In de artikellijst van de klant: klik bij het **vrije artikel** op het **📚-icoon** (rechts in de rij).
    **Verwacht:** er opent een **productformulier** (geen kaal vinkje). Merk/naam zijn voor-ingevuld met wat je typte.
22. Vul het formulier zo compleet mogelijk: type (bv. PBM), categorie, materiaal, norm, max. leeftijden, MBS, en een handleiding-/recall-link. Klik **Aanmelden bij de catalogus**.
    **Verwacht:** dialoog sluit, het 📚-icoon kleurt **op** (actief = aangemeld).
23. Klik nogmaals op het 📚-icoon van hetzelfde artikel.
    **Verwacht:** het formulier heropent met **jouw eerder ingevulde waarden** (niet leeg), plus een knop **Aanmelding intrekken**.
24. SQL-controle: `select suggest_for_catalog, catalog_suggestion from articles where suggest_for_catalog = true;`
    **Verwacht:** `suggest_for_catalog = true` en `catalog_suggestion` bevat je ingevulde JSON.
25. Sluit het formulier (Annuleren).

## Fase F — Keuring uitvoeren → certificaat

26. Klantdetail → **Start keuring** (of via Keuringen).
    **Verwacht:** de keuring-wizard opent met de artikelen van de klant klaargezet.
27. Zet het eerste artikel op **Goedgekeurd**.
    **Verwacht:** groen vinkje, veld "volgende keuring" verschijnt met een datum.
28. Pas de **volgende-keuringsdatum** handmatig aan.
    **Verwacht:** datum wordt overgenomen.
29. Zet het tweede artikel op **Afgekeurd**, kies een **afkeurcode** en typ een opmerking.
    **Verwacht:** rood kruisje, afkeurcode + opmerking opgeslagen.
30. Controleer bij een artikel de **Gebruiker**-kolom en (indien catalogusproduct) een eventuele **recall-/handleiding-link**.
    **Verwacht:** kolommen tonen de juiste data.
31. Klik **Afronden**.
    **Verwacht:** een **certificaat-PDF** wordt gegenereerd en een downloadlink verschijnt (geen RLS-fout bij de upload).
32. Open/download de PDF.
    **Verwacht:** kop/voettekst Safety Green, per artikel goed/afgekeurd met SN + afkeurcode, "volgende keuring uiterlijk", je **handtekening**, en een **verificatie-QR** met het Gearonimo-merk.
33. Scan de QR (of open de link) op de telefoon.
    **Verwacht:** de publieke **/verify**-pagina zegt dat het certificaat echt is (zonder alle klantdata te tonen).
34. SQL-controle: `select number, storage_path from certificates;`
    **Verwacht:** één certificaat-rij met een nummer in de vorm `JJJJMMDD-KLANTNAAM`.

## Fase G — Serienummer- en recall-zoeken

35. Hoofdmenu → zoekbalk bovenaan → typ (een deel van) een **serienummer** van een artikel → Enter.
    **Verwacht:** de SN-zoekpagina opent met de treffer(s), klantnaam en status.
36. Klik een treffer aan.
    **Verwacht:** je komt op het artikeldetail.
37. Op de SN-zoekpagina → schakel naar **Recall zoeken** → zoek op merk + product + een fabricagedatum-bereik.
    **Verwacht:** een resultatenlijst; artikelen zonder bouwjaar worden getoond én gemarkeerd ("bouwjaar onbekend"). CSV-export knop aanwezig.

## Fase H — Sets (samengestelde artikelen)

38. Klantdetail → Sets → nieuwe set (bv. "Fliplijn compleet") → voeg 2 artikelen toe als leden.
    **Verwacht:** set aangemaakt met de gekozen artikelen.
39. Open het setdetail.
    **Verwacht:** de leden staan er; je kunt een lid verwijderen/toevoegen.

## Fase I — Catalogus-curator: wachtrij + beheer (TAAK 1, curatorkant)

40. Instellingen → **Catalogus** → tab **Wachtrij**.
    **Verwacht:** het in fase E aangemelde artikel staat in de wachtrij, met klantnaam en de vrije velden.
41. Klik **Toevoegen aan catalogus** bij dat artikel.
    **Verwacht:** het productformulier opent **voor-ingevuld met jouw aanmelding** (het ingevulde voorstel, niet alleen merk/naam).
42. Controleer/corrigeer de velden en klik **Product aanmaken**.
    **Verwacht:** het artikel verdwijnt uit de wachtrij; het is nu aan een echt catalogusproduct gekoppeld.
43. SQL-controle: `select suggest_for_catalog, product_id, catalog_suggestion from articles where id = '<dat artikel>';`
    **Verwacht:** `suggest_for_catalog = false`, `product_id` gevuld, `catalog_suggestion = null`.
44. Catalogus → tab **Catalogus** → zoek het zojuist gemaakte product.
    **Verwacht:** het staat in de lijst en is te bewerken.
45. Klik **Exporteren naar Excel**.
    **Verwacht:** een `.xlsx` met alle producten downloadt.
46. Wijzig in dat Excel-bestand één veld van een bestaand product en importeer het terug (**Importeren uit Excel**).
    **Verwacht:** een dryrun-preview (nieuw/bijgewerkt/overgeslagen) vóór bevestigen; na bevestigen is de wijziging doorgevoerd.

## Fase J — Excel/CSV-import (historische keuringen)

47. Instellingen → **Excel/CSV-import** → kies een testbestand (`.xlsx`/`.csv`) met een paar artikelrijen.
    **Verwacht:** stap 1 toont het bestand; bij meerdere tabbladen kun je er één kiezen.
48. Stap 2: klik de **koprij** aan in de voorvertoning.
    **Verwacht:** de kolomkoppen worden herkend vanaf die rij.
49. Stap 3: koppel de kolommen (Klant/Artikel/Keuring). Gebruik evt. **vaste klantnaam** en **vaste keuringsdatum** als het bestand die niet heeft.
    **Verwacht:** per kolom een dropdown met voorbeeldwaarden.
50. Stap 4: bekijk de **droogloop-validatie + preview** (eerste 10 rijen, dubbele serienummers, lege verplichte velden).
    **Verwacht:** duidelijke melding als er iets mis is; anders groen.
51. Stap 5: **Importeren**.
    **Verwacht:** klanten/artikelen/keuring aangemaakt; het originele bestand gaat naar de private `imports`-bucket.
52. Controleer in Klanten dat de geïmporteerde klant(en) verschijnen met hun artikelen.
    **Verwacht:** aanwezig, artikelen met `source = 'import'`.

## Fase K — Klant-app: koppelen via uitnodigingscode

53. Open (in een **privé-venster** of op de telefoon) https://gearonimo.net/portal/.
    **Verwacht:** inlogscherm van de klant-app.
54. Log in met een **nieuw** e-mailadres via de **magic link** (check de mailbox, klik de link).
    **Verwacht:** je landt terug in de klant-app zonder wit scherm.
55. **Verwacht (belangrijk):** je ziet het **startscherm** met twee keuzes: *"Ik heb een uitnodigingscode"* en *"Zelf beginnen"*.
56. Kies **Ik heb een uitnodigingscode** → voer **KLANT-1** in (fase D) + je naam → bevestig.
    **Verwacht:** je komt op het **dashboard** van "Klimvereniging De Rots".
57. Dashboard: bekijk het **stoplicht** + tellers en de artikelen.
    **Verwacht:** de artikelen uit fase D/F staan er, met status (✓/!/✗) en volgende-keuringsdatum; het afgekeurde artikel telt als "actie nodig".
58. Bekijk **Certificaten**.
    **Verwacht:** het certificaat uit fase F staat er, met **⬇ PDF**-download.
59. Bovenin: open **Medewerkers** (jij bent admin).
    **Verwacht:** ledenlijst met jou als beheerder; de uitnodigingscode is zichtbaar om collega's te laten koppelen.
60. Dashboard → **+ Toevoegen** (materiaal): voeg een artikel toe via catalogus-zoeken.
    **Verwacht:** artikel toegevoegd; verschijnt in de lijst.
61. Voeg een artikel toe met een **onbekend product** (vrije invoer).
    **Verwacht:** toegevoegd; dit gaat automatisch de **catalogus-wachtrij** in (curator ziet het later).
62. Voer bij een artikel **Afvoeren** uit (🗑) met een reden (bv. "verloren").
    **Verwacht:** artikel verdwijnt uit de lijst.
63. Terug in de **Pro-app** → dat afgevoerde artikel via SN-zoeken.
    **Verwacht:** vindbaar als "Afgevoerd (reden)"; klikken = weer in gebruik nemen.

## Fase L — Klant-app: zelf aanmelden + keuring aanvragen (TAAK 2, leadmotor)

64. Open opnieuw (nieuw privé-venster) https://gearonimo.net/portal/ en log in met **weer een ander, nieuw** e-mailadres (magic link).
    **Verwacht:** startscherm met de twee keuzes.
65. Kies **Zelf beginnen** → vul een naam/bedrijfsnaam in (bv. "Jansen Klimtechniek") → **Beginnen**.
    **Verwacht:** je komt op het dashboard.
66. **Verwacht (belangrijk):** een blauwe banner *"Je materiaal is nog niet gekoppeld aan een keurbedrijf. Vraag een keuring aan wanneer je wilt."* (geen rood alarm).
67. SQL-controle: `select c.name, cl.status from customers c left join customer_links cl on cl.customer_id = c.id where c.name = 'Jansen Klimtechniek';`
    **Verwacht:** de klant bestaat, **zonder** customer_link (staat op zichzelf).
68. Dashboard → **+ Toevoegen** → voeg wat eigen materiaal toe.
    **Verwacht:** toegevoegd; dashboard toont "nog niet gekeurd".
69. Bovenin/banner → **Keuring aanvragen**.
    **Verwacht:** de aanvraagpagina opent met een **wereldkaart**.
70. Bekijk de kaart.
    **Verwacht:** één **groene pin** bij Elst (Safety Green). Onder de kaart een lijst met Safety Green.
71. Typ in het **zoekveld** een deel van "Safety".
    **Verwacht:** Safety Green verschijnt als zoekresultaat (naam-zoeken werkt ook los van de kaart).
72. Klik de pin **of** het lijst-item aan.
    **Verwacht:** een bevestigingskaart "Aanvraag sturen naar Safety Green B.V.?" met een optioneel bericht-veld.
73. Typ een kort bericht en klik **Aanvraag sturen**.
    **Verwacht:** bij "Mijn aanvragen" verschijnt Safety Green met status **In behandeling**; op het dashboard staat nu de gele *"wacht op goedkeuring"*-banner.
74. Probeer dezelfde aanvraag nog eens te sturen.
    **Verwacht:** geen dubbele aanvraag (dezelfde openstaande wordt hergebruikt).

## Fase M — Pro-app: aanvraag goedkeuren

75. Ga naar de **Pro-app** (keurmeester) → hoofdmenu.
    **Verwacht:** de tegel **Aanvragen** toont een rood **badge-getal** (1).
76. Open **Aanvragen**.
    **Verwacht:** de aanvraag van "Jansen Klimtechniek" staat er, met bron ("Via de openbare kaart") en het bericht.
77. Klik **Afwijzen** op een testaanvraag (maak er evt. eerst nog één aan vanuit de klant-app om dit los te testen).
    **Verwacht:** aanvraag verdwijnt; in de klant-app wordt de status "Afgewezen".
78. Klik bij de echte aanvraag op **Goedkeuren** → bevestig de melding.
    **Verwacht:** aanvraag verdwijnt uit de lijst; badge weg.
79. SQL-controle: `select status from customer_links where customer_id = (select id from customers where name = 'Jansen Klimtechniek');`
    **Verwacht:** een **active** koppeling naar Safety Green.
80. Terug in de **klant-app** (Jansen) → herlaad.
    **Verwacht:** de banner is weg; er staat nu *"Gekoppeld aan Safety Green B.V."*.
81. Pro-app → **Klanten**.
    **Verwacht:** "Jansen Klimtechniek" staat nu in je klantenlijst, met het zelf-ingevoerde materiaal — je kunt er een keuring voor starten.

## Fase N — Rollen-afscherming

82. Log in de **Pro-app** uit en log in met een **klant-account** (bv. het account van fase 56).
    **Verwacht:** het hoofdmenu toont **alleen** de melding "dit is geen keurmeester-account" + link naar /portal/ — **geen** tegels, geen zoekbalk.
83. Probeer handmatig naar `gearonimo.net/customers` of `/settings` te gaan.
    **Verwacht:** je wordt teruggestuurd naar het hoofdmenu (geen toegang tot Pro-schermen).
84. Log uit; log weer in als **keurmeester**.
    **Verwacht:** volledige toegang terug.

## Fase O — Wachtwoord vergeten (Pro-app)

85. Log uit → inlogscherm → **Wachtwoord vergeten**.
    **Verwacht:** je kunt een e-mailadres invoeren; er wordt een reset-mail gestuurd.
86. Open de reset-link uit de mail.
    **Verwacht:** de reset-pagina opent (`/reset-password`); je kunt een nieuw wachtwoord instellen en daarna inloggen.

## Fase P — Offline (op de telefoon/tablet)

87. Pro-app → **Offline downloads** → stel een **PIN** in.
    **Verwacht:** PIN-dialoog; daarna een lege downloadlijst met snelkeuzes "Vandaag"/"Deze week".
88. Download één klant.
    **Verwacht:** de klant verschijnt in de offline-lijst.
89. Zet het toestel in **vliegtuigstand** en heropen de app.
    **Verwacht:** de app opent (app-shell offline), je kunt na PIN-ontgrendelen de gedownloade klant + artikelen zien.
90. Start/hervat offline een keuring en vul een paar resultaten in.
    **Verwacht:** invoer wordt lokaal bewaard; onderin een syncbalk met "nog niet gesynchroniseerd".
91. Zet het netwerk weer aan (of druk **Nu synchroniseren**).
    **Verwacht:** de wachtrij loopt leeg; offline afgeronde keuringen krijgen alsnog hun certificaat.
92. Controleer in de klant-app dat de offline gemaakte keuring/certificaat zichtbaar is.
    **Verwacht:** aanwezig.

## Fase Q — Historie reist mee met de klant (overstap) — geavanceerd/optioneel

> Vereist een **tweede keurbedrijf** + tweede keurmeester. Doe dit alleen als je
> de overstap-logica wilt bevestigen (jouw punt: keurbedrijf B moet de historie
> van A kunnen zien).

93. SQL: maak een tweede bedrijf + zet 'm op de kaart:
    ```sql
    insert into public.inspection_companies (name, country_code, listed, latitude, longitude, city)
    values ('Testkeur B.V.', 'NL', true, 52.0907, 5.1214, 'Utrecht');
    ```
    **Verwacht:** `Success`.
94. Supabase → Add user `keurmeester2@test.nl` (Auto Confirm). Log in de Pro-app in met dat account zodat ensure_inspector een inspector aanmaakt; koppel die inspector aan het nieuwe bedrijf:
    ```sql
    update public.inspectors
    set company_id = (select id from inspection_companies where name = 'Testkeur B.V.')
    where user_id = (select id from auth.users where email = 'keurmeester2@test.nl');
    ```
    **Verwacht:** `1 row`.
95. Klant-app (een klant die al bij Safety Green gekeurd is, bv. "Klimvereniging De Rots" — log in met dat klant-account) → **Keuring aanvragen** → kies **Testkeur B.V.** → versturen.
    **Verwacht:** aanvraag verstuurd.
96. Log in de Pro-app in als **keurmeester2** → Aanvragen → **Goedkeuren**.
    **Verwacht:** aanvraag geaccepteerd.
97. SQL-controle: `select company_id, status from customer_links where customer_id = (select id from customers where name = 'Klimvereniging De Rots');`
    **Verwacht:** de link naar Safety Green is **ended**, de link naar Testkeur is **active** (overstap).
98. Als keurmeester2 → open die klant → **Start keuring**.
    **Verwacht (de kern):** je ziet bij de artikelen de **"vorige keuring"-context** van Safety Green (de historie reist mee), én de klant staat in je klantenlijst.
99. Log weer in als de **eerste keurmeester** (Safety Green) → Klanten.
    **Verwacht:** "Klimvereniging De Rots" is **niet meer** zichtbaar (koppeling beëindigd), maar het eerder door Safety Green gemaakte certificaat blijft in jullie eigen administratie leesbaar.

## Afronding

100. Noteer per fase wat ✅ ging en wat ❌ (met de melding/screenshot). Stuur dat terug,
     dan pak ik de ❌'s één voor één op.

---

### Handige controle-query's (Supabase SQL-editor)

```sql
-- Overzicht van de kernaantallen:
select
  (select count(*) from customers)                          as klanten,
  (select count(*) from articles where not retired)         as artikelen,
  (select count(*) from inspections where status='completed') as keuringen,
  (select count(*) from certificates)                       as certificaten,
  (select count(*) from inspection_requests)                as aanvragen,
  (select count(*) from articles where suggest_for_catalog) as wachtrij;

-- Openstaande aanvragen met klant + bedrijf:
select r.status, r.source, cu.name as klant, ic.name as bedrijf, r.created_at
from inspection_requests r
join customers cu on cu.id = r.customer_id
join inspection_companies ic on ic.id = r.company_id
order by r.created_at desc;

-- Koppelingen per klant:
select cu.name as klant, ic.name as bedrijf, cl.status
from customer_links cl
join customers cu on cu.id = cl.customer_id
join inspection_companies ic on ic.id = cl.company_id
order by cu.name;
```
