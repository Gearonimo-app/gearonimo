# Testplan Gearonimo — ronde 2 (opgesteld 2026-07-31)

Dit plan vervangt het A-Z-testplan van 6 juli. Dat plan begon met een volledige
reset (alle klanten, keurmeesters en accounts wissen) en kende de app van nu
niet meer: er zijn sindsdien werk-tabbladen, een hero-foto, gedeelde
paginakoppen, de artikel-koppelflow, de platform-admin en een opgeschoonde
catalogus bijgekomen. Het oude plan blijft in de git-historie staan.

**Twee uitgangspunten deze ronde:**

1. **Niets gaat eruit.** Geen reset, geen klanten of keurmeesters verwijderen,
   geen accounts opruimen. Je test op de echte database zoals hij nu is, met je
   eigen account.
2. **Zo weinig mogelijk werk.** Eén testklant die je zelf aanmaakt, en verder
   alleen kijken en klikken. Op één plek (vooraf) is SQL nodig, daarna niet
   meer.

**Zo werkt het:** doe de stappen op nummer en noteer per stap ✅ of ❌ (met wat
je ziet). Elke stap heeft een **Verwacht:**-regel om mee te vergelijken. Elke
fase is een blokje van ±10 minuten; je kunt tussen fases stoppen en later
verdergaan.

- **Pro-app (keurmeester):** https://gearonimo.net
- **Klant-app:** https://gearonimo.net/portal/
- **Supabase:** project `buitfeiclivzzldfdelp` → SQL editor

> **Waar het deze ronde vooral om gaat:** de tabbladen (fase 2), de
> artikel-koppelflow (fase 4) en de catalogus (fase 6). Dat is het nieuwste werk
> en dus waar de kans op een gemiste hoek het grootst is. Heb je maar een half
> uur: doe fase 0, 2 en 4.

---

## Fase 0 — Vooraf: vier migraties (eenmalig, ±5 min)

De app is gedeployed maar deze vier stukken database staan nog open. Zonder
deze stap geven een paar knoppen gewoon een foutmelding.

Ga naar Supabase → SQL editor, plak per stuk de inhoud van het bestand en klik
**Run**:

1. `supabase/migrations/20260748_platform_admin_set_password.sql`
   **Verwacht:** `Success`. (Nodig voor "Wachtwoord instellen" in Bedrijven.)
2. `supabase/migrations/20260750_search_products_manufacturer_code.sql`
   **Verwacht:** `Success`. (Nodig om in de klant-app op artikelcode te zoeken.)
3. `supabase/migrations/20260751_delete_product.sql`
   **Verwacht:** `Success`. (Nodig voor "Product verwijderen" in de catalogus.)
4. `supabase/migrations/20260752_products_unique_index.sql`
   **Verwacht:** `Success`, met onderin de melding
   `Unieke index products_brand_name_uniq staat klaar.`
   Staat er in plaats daarvan `Let op: nog N dubbele merk+naam-combinaties`, dan
   zitten er nog dubbelen in de catalogus — geef dat aantal door, dan ruimen we
   die eerst op.

> ⚠️ **Draai `20260749_catalog_reset_and_unique.sql` NIET.** Dat bestand hoorde
> bij de catalogus-opschoning van 28 juli: het koppelt élk artikel los van zijn
> product en maakt de catalogus leeg. Draai je het nu, dan is je hele
> koppelronde weg. Migratie `20260752` hierboven bevat het enige stukje dat nog
> nodig was (het slot op dubbelen), zonder die twee wisstappen.

5. Controleer de stand van de catalogus. SQL:
   ```sql
   select
     (select count(*) from public.products)                              as producten,
     (select count(*) from public.articles where product_id is not null) as gekoppelde_artikelen;
   ```
   **Verwacht:** `producten` ≈ 2291 (de gecorrigeerde bronlijst), en
   `gekoppelde_artikelen` = ongeveer het aantal dat je met de hand hebt
   gekoppeld. Wijkt `producten` sterk af (bijv. ~5700, of 0), geef het getal dan
   door voordat je verdergaat.

---

## Fase 1 — Opstarten, icoon en hoofdmenu (±5 min, doe dit op de telefoon)

6. Verwijder de app van je telefoon als hij er als PWA op staat, en zet hem
   opnieuw op je beginscherm via de browser ("Toevoegen aan beginscherm").
   **Verwacht:** het icoon is de groene karabiner met vinkje, scherp, zonder wit
   blok eromheen en zonder woordmerk.
7. Start de app vanaf het beginscherm.
   **Verwacht:** het opstartscherm (splash) toont hetzelfde scherpe logo op wit —
   geen blokkerig, uitgerekt grijs plaatje.
8. Log in.
   **Verwacht:** op het inlogscherm staat het groene pil-label
   "Keurder-app · voor keurmeesters".
9. Bekijk het hoofdmenu.
   **Verwacht:** de sfeerfoto op de achtergrond met daarover glas-tegels. **Zes**
   tegels: Keuringen, Klanten, Aanvragen, Offline downloads, SN zoeken / Recall,
   Instellingen. Géén zoekbalk en géén grote kaart met "artikelen te herkeuren"
   (die is er bewust af).
10. Pak de laptop erbij of draai de telefoon.
    **Verwacht:** op een breed scherm staan de tegels als 3×2, netjes
    gecentreerd; op de telefoon onder elkaar. Geen tegel die halverwege afbreekt.
11. Open Klanten en kijk naar de kopbalk.
    **Verwacht:** één vaste kopbalk met terug- en home-knop links en de titel in
    het midden, met de gedimde sfeerfoto als kopstrook. Op elke subpagina
    hetzelfde — geen pagina die er anders uitziet.

---

## Fase 2 — Werk-tabbladen (±10 min) ⭐ nieuw

Dit is het grootste nieuwe stuk: de app werkt nu als een mini-browser met
meerdere pagina's tegelijk open. Doe deze fase rustig — hier zit de meeste
nieuwe techniek.

12. Bekijk de strook bovenaan het scherm.
    **Verwacht:** een tabbladenstrook boven de kopbalk, met één tabblad
    ("Hoofdmenu") en een **+**-knop.
13. Open Klanten → klik een klant aan.
    **Verwacht:** het tabblad krijgt de naam van die klant (bijv. "Acme Klimhal
    B.V."), niet "Klant" of "Pagina".
14. Klik op de **+** in de strook.
    **Verwacht:** er komt een tweede tabblad bij, dat op het hoofdmenu staat. Het
    eerste tabblad blijft bestaan.
15. Ga in dat tweede tabblad naar Instellingen → Catalogus en typ iets in het
    zoekveld.
16. Klik in de strook terug naar het eerste tabblad.
    **Verwacht:** je klant staat er nog precies zoals je hem verliet — zelfde
    plek, ingeklapte/uitgeklapte blokken nog hetzelfde. Hij laadt niet opnieuw.
17. Ga weer naar het tweede tabblad.
    **Verwacht:** de catalogus staat er nog, met je zoekterm er nog in.
18. Open een derde tabblad (**+**) → Klanten → **Klant toevoegen** → maak de
    testklant aan die we hierna gebruiken: naam **ZZ Test 31-07**, verder alleen
    wat verplicht is. Opslaan.
    **Verwacht:** de klant wordt aangemaakt.
19. Ga naar het tabblad waar de klantenlijst al open stond (uit stap 13; ga daar
    één stap terug naar Klanten).
    **Verwacht:** **ZZ Test 31-07** staat in die lijst. Dít is het punt: een lijst
    in een ander tabblad ververst zichzelf als je erop terugkomt — hij staat niet
    eeuwig verouderd.
20. Sluit een tabblad met het kruisje.
    **Verwacht:** het tabblad verdwijnt en je komt op een ander tabblad terecht,
    niet op een leeg scherm.
21. Sluit alle tabbladen op één na.
    **Verwacht:** bij het laatste tabblad is er geen kruisje meer — dat kun je
    niet sluiten.
22. Open 8 tabbladen (blijf op **+** klikken).
    **Verwacht:** bij 8 kun je er geen meer bij; er verschijnt "Maximaal 8
    tabbladen tegelijk". Geen vastloper.
23. Sluit terug naar 2 tabbladen en herlaad de pagina (of sluit de app en start
    hem opnieuw).
    **Verwacht:** de strook met die 2 tabbladen komt terug. De inhoud ván de
    pagina's begint wel opnieuw — dat kan niet anders en is goed.
24. Log uit en weer in.
    **Verwacht:** je begint met één schoon tabblad; de oude tabbladen zijn weg.

---

## Fase 3 — Testklant en artikelen (±10 min)

We gebruiken **ZZ Test 31-07** uit stap 18, zodat je echte klanten ongemoeid
blijven.

25. Open ZZ Test 31-07 → blok **Artikelen** → voeg een artikel toe **uit de
    catalogus**: zoek op `petzl` en kies een gordel of karabiner. Vul serienummer
    `TEST-001` in plus een bouwjaar. Opslaan.
    **Verwacht:** het artikel staat in de lijst, met merk en naam van het
    catalogusproduct.
26. Voeg een tweede toe als **vrij artikel** (niet uit de catalogus):
    omschrijving `Distel Alu kort`, merk `Distel`, serienummer `TEST-002`.
    **Verwacht:** het artikel staat in de lijst en is herkenbaar als niet-gekoppeld.
27. Voeg een derde toe, ook vrij: omschrijving `Fallsafe FS242-L-XL`, serienummer
    `TEST-003`.
28. Klap de blokken op de klantpagina in en uit (Artikelen, Sets, Medewerkers,
    Certificaten, Keuringen).
    **Verwacht:** elk blok klapt open/dicht en toont het juiste aantal in de kop.

---

## Fase 4 — Artikelpagina: koppelen en corrigeren (±15 min) ⭐ veel gewijzigd

29. Open artikel `TEST-002` (het vrije "Distel Alu kort").
    **Verwacht:** een blok **Koppel aan catalogusproduct**, met de **Originele
    omschrijving** ("Distel Alu kort") als vaste referentie erboven en een
    zoekveld dat al voorgevuld is.
30. Bekijk de suggesties onder het veld.
    **Verwacht:** ondanks dat "kort" in geen enkele catalogusnaam voorkomt, komen
    er Distel Alu-producten naar boven (bijv. Distel Alu 3.1 / Alu Plus). Niet
    "Geen passend product gevonden".
31. Typ in het zoekveld `petzl seq`.
    **Verwacht:** er komen resultaten — merk en naam samen worden gevonden. Dit
    gaf eerder nul resultaten.
32. Maak het veld leeg en typ `242`.
    **Verwacht:** het FALL SAFE-product komt naar boven op zijn artikelcode, en
    die code staat in de suggestieregel zodat je ziet dát het de juiste maat is.
33. Kies een product uit de lijst.
    **Verwacht:** het artikel is gekoppeld. Het blok heet nu **Gekoppeld
    catalogusproduct** met de productnaam, plus **Ander product kiezen** en
    **Ontkoppelen**. Keurtermijn en handleiding komen nu van het product.
34. Klik **Ander product kiezen**.
    **Verwacht:** hetzelfde zoekveld opent, voorgevuld met de huidige
    productnaam. Kies een ander product → de koppeling is gewijzigd. (Dit was
    eerder onmogelijk: een misklik was definitief.)
35. Klik **Ontkoppelen**.
    **Verwacht:** het artikel is weer vrij, en merk + omschrijving staan er weer
    als vrije tekst op — geen artikel zonder omschrijving.
36. Kijk naar het blok **Opmerkingen** onder de gegevens.
    **Verwacht:** dat staat er altijd, ook als het leeg is, en je kunt er direct
    in typen. Typ iets → Opslaan/Annuleren verschijnen → Opslaan. Na een herlaad
    staat de opmerking er nog.
37. Zoek via het potlood het veld **Keurtermijn (maanden)**.
    **Verwacht:** in te vullen, en de volgende-keuringsdatum rekent daarmee.
38. Onderaan de artikelpagina: klik **Volgende →**.
    **Verwacht:** het volgende artikel van deze klant, met een teller als "2 / 3".
    De pagina toont écht het nieuwe artikel — niet het oude met een nieuw
    nummertje.
39. Klik **← Vorige**.
    **Verwacht:** je bent terug op het vorige artikel, mét wat je daar had staan.
40. Klik **Volgend vrij artikel (n te koppelen)**.
    **Verwacht:** hij slaat artikelen over die al aan de catalogus hangen en landt
    op een vrij artikel; het aantal in de knop klopt.
41. Open ditzelfde artikel in een tweede tabblad (**+** → zelfde klant → zelfde
    artikel), en klik in het eerste tabblad door naar een ander artikel.
    **Verwacht:** het tweede tabblad blijft op zijn eigen artikel staan en gaat
    niet mee. (Dit ging eerder mis.)

---

## Fase 5 — Keuring uitvoeren en certificaat (±15 min)

42. Keuringen → **Nieuwe keuring starten** → kies ZZ Test 31-07.
    **Verwacht:** de vraag welke artikelen meegaan (Alles / Alleen nieuwe). Kies
    **Alles**.
43. Loop de keuring door: artikel 1 op **Goed**, artikel 2 op **Afgekeurd** met
    een afkeurcode en een opmerking, artikel 3 laat je open.
    **Verwacht:** onderaan lopen de tellers mee: "1 goed · 1 afgekeurd · 1 nog te
    doen". Elk resultaat wordt opgeslagen zonder foutmelding.
44. Zoek in het zoekveld op de laatste cijfers van een serienummer (`003`).
    **Verwacht:** het juiste artikel wordt gevonden.
45. Klik **Afronden →**.
    **Verwacht:** een melding dat 1 artikel niet gekeurd is en niet op het
    certificaat komt (het blijft bij de klant staan). Bevestig.
46. Bekijk het voorstel voor de volgende keuringsdatum en rond af.
    **Verwacht:** een datum ±12 maanden vooruit, aanpasbaar. Na opslaan:
    "Certificaat gegenereerd en gearchiveerd" + **Certificaat downloaden**.
47. Download het certificaat.
    **Verwacht:** een PDF in je Downloads-map. Daarin: je bedrijfslogo, het
    certificaatnummer, de gekeurde artikelen, en het afgekeurde artikel mét code.
    Het niet-gekeurde artikel staat er **niet** op.
48. Scan de QR-code op het certificaat (of open de verify-link).
    **Verwacht:** "Echt certificaat", met certificaatnummer, klant,
    keuringsdatum, de keurmeester-naam en de artikelen. Op deze pagina is géén
    tabbladenstrook — die staat bewust los.
49. Ga naar Keuringen en zoek op het certificaatnummer.
    **Verwacht:** de keuring wordt gevonden; het certificaatnummer staat in de
    lijst.
50. Open een **geïmporteerde** keuring van een echte klant (uit de Excel-import),
    als je die hebt.
    **Verwacht:** géén "Certificaat gegenereerd", maar "Geïmporteerd uit een oud
    certificaat. Er is geen nieuw certificaat aangemaakt…". Bij die klant staat
    terecht "Certificaten (0)".

---

## Fase 6 — Catalogus (±15 min, alleen als curator) ⭐ veel gewijzigd

51. Instellingen → **Catalogus** → tab **Catalogus**.
    **Verwacht:** de volledige productenlijst met een zoekveld, en een aantal dat
    klopt met stap 5 (≈2291) — niet 1000.
52. Zoek op `petzl seq`, daarna op een artikelcode (bijv. `M33A`), daarna op een
    categorie.
    **Verwacht:** alle drie geven resultaat — het zoekveld kijkt naar merk, naam,
    categorie én artikelcode tegelijk.
53. Open een product en bekijk het formulier.
    **Verwacht:** in elk veld staat een voorbeeld (grijze hint), en
    **Producttype** is een keuzelijst — geen vrij tekstveld.
54. Kijk bij de levensduurvelden.
    **Verwacht:** de hint "999 = onbeperkte levensduur. Leeg = nog niet
    opgezocht." Zoek een product met 999 erin.
    **Verwacht:** dat geeft géén afkeurdatum en géén levensduurwaarschuwing —
    nergens een jaartal als 3025.
55. **Product toevoegen** → merk `ZZ TEST`, naam `Testkarabiner` → opslaan.
    **Verwacht:** het product staat in de lijst.
56. Probeer nóg een product aan te maken met exact hetzelfde merk + naam.
    **Verwacht:** dat wordt geweigerd (het slot uit migratie 20260752).
57. Open `ZZ TEST Testkarabiner` → **Kopiëren naar nieuw product (bv. andere
    maat)**.
    **Verwacht:** een nieuw formulier met de velden overgenomen; geef het een
    andere naam en sla op.
58. Open `ZZ TEST Testkarabiner` → **Product verwijderen**.
    **Verwacht:** een rood bevestigingsblok. Omdat dit product nergens in gebruik
    is: "Dit product staat nergens in gebruik en wordt definitief verwijderd."
    Bevestig → het product is weg. Doe hetzelfde met de kopie. (Werkt dit niet,
    dan is migratie 20260751 uit fase 0 niet gedraaid.)
59. Klik **Exporteren naar Excel**.
    **Verwacht:** een `.xlsx` met **alle** producten (≈2291 rijen, niet 1000) en
    alle kolommen.
60. Klik **Importeren uit Excel** en kies het bestand dat je net exporteerde.
    **Verwacht:** de preview meldt dat vrijwel alles **al bestond (overgeslagen)**
    en 0 nieuw. Bevestig.
    **Verwacht:** er komt niets dubbel bij, het aantal producten blijft gelijk, en
    tijdens het importeren zie je voortgang ("… van … toegevoegd").

---

## Fase 7 — Aanmelden voor de catalogus en de wachtrij (±10 min)

61. Open het vrije artikel `TEST-002` → in de koppelsectie: **Toevoegen aan
    productendatabase**.
    **Verwacht:** een productformulier dat al is voorgevuld met wat in de vrije
    velden stond (merk, omschrijving). Vul aan en klik **Aanmelden bij de
    catalogus**.
62. Instellingen → Catalogus → tab **Wachtrij**.
    **Verwacht:** je aanmelding staat er, **met de velden die je invulde** — niet
    kaal.
63. Vul de rest aan en klik **Toevoegen aan catalogus**.
    **Verwacht:** er komt een echt catalogusproduct, het artikel wordt eraan
    gekoppeld, en de aanmelding verdwijnt uit de wachtrij.
64. Meld nog een artikel aan en klik deze keer **Afwijzen**.
    **Verwacht:** de aanmelding verdwijnt en er komt géén product bij.
65. Ruim het product uit stap 63 op via **Product verwijderen**.
    **Verwacht:** de waarschuwing meldt nu dat het **1 keer gebruikt** wordt, en
    dat het artikel blijft bestaan met merk en naam als vrije tekst. Bevestig, en
    controleer het artikel.
    **Verwacht:** het artikel bestaat nog, met omschrijving, weer als vrij artikel.

---

## Fase 8 — Spiekbriefje en SN-referentie (±5 min)

66. Open een keuring of de SN-zoekpagina en klap **Spiekbriefje — dag/week &
    SN-referentie** open.
67. Tab **Dag / week**: vul dag `123` in.
    **Verwacht:** 3 mei 2026. Vul daarna `366` in.
    **Verwacht:** "Bestaat niet in dit jaar" (2026 is geen schrikkeljaar).
    *(De tooltip bij dit veld in de keuring zei eerder "1 mei" — dat was een
    fout in de hulptekst, niet in de rekenaar; hij is bijgewerkt.)*
68. Vul week `12` in.
    **Verwacht:** een datumbereik van maandag t/m zondag.
69. Tab **SN-referentie**: filter op `petzl`.
    **Verwacht:** het serienummerformaat van Petzl met uitleg van de tekens
    (Y = jaar, D = dagnummer, …) en een voorbeeld.

---

## Fase 9 — Klant-app (±15 min)

> Let op: beide apps delen de sessie op hetzelfde domein. Log je in `/portal/`
> met een klant-account in, dan ben je in de Pro-app uitgelogd. Doe deze fase
> daarom als laatste, of reken erop dat je daarna opnieuw inlogt.

70. Pro-app → klantpagina van ZZ Test 31-07 → kopieer de **uitnodigingscode**.
    **Verwacht:** de code staat er met een kopieerknop.
71. Open https://gearonimo.net/portal/ op je telefoon.
    **Verwacht:** het blauwe pil-label "Klantportaal · voor klanten", en een
    startkeuze: uitnodigingscode óf zelf beginnen.
72. Log in met een e-mailadres dat je nog niet gebruikt — bijvoorbeeld
    `josvdhoogen+klanttest@gmail.com`; die mail komt gewoon in je eigen postvak.
    Volg de magic-link.
    **Verwacht:** je landt in de klant-app, niet in de Pro-app, en niet op een wit
    scherm.
73. Koppel met de uitnodigingscode uit stap 70.
    **Verwacht:** je hangt aan ZZ Test 31-07, en omdat dit het eerste account is
    ben je meteen **beheerder**.
74. Bekijk het dashboard.
    **Verwacht:** een stoplicht-oordeel met tellers. Omdat er in fase 5 een
    artikel is afgekeurd: "Actie nodig". Plus de tegels Mijn materiaal,
    Certificaten en Keuring aanvragen.
75. Open **Mijn materiaal**.
    **Verwacht:** je testartikelen met status-chips (✓/✗), de
    volgende-keuringsdatum, en de filters (gebruiker, Aandacht nodig).
76. Open het afgekeurde artikel.
    **Verwacht:** de laatste keuring met resultaat, en een handleiding-link als
    het product die heeft.
77. Open **Certificaten** → download het certificaat uit fase 5.
    **Verwacht:** dezelfde PDF landt in je Downloads-map.
78. Materiaal → **+ Toevoegen** → zoek in de catalogus op een artikelcode
    (bijv. `M33A`).
    **Verwacht:** het product wordt gevonden. (Zo niet, dan is migratie 20260750
    uit fase 0 niet gedraaid.) Voeg het toe met serienummer `TEST-004`.
79. Voeg er nog één toe via **Staat het er niet tussen? Zelf invullen**.
    **Verwacht:** het artikel komt erbij, en in de Pro-app staat het op de
    catalogus-wachtrij.
80. Voer een artikel af via **Vervangen? Afvoeren** met een reden.
    **Verwacht:** het verdwijnt uit het overzicht; de historie blijft bewaard.
81. Open **Medewerkers**.
    **Verwacht:** jij staat er met de badge **Beheerder**, plus de
    uitnodigingscode met uitleg. Voeg een medewerker toe (naam + functie).
    **Verwacht:** die komt in de lijst met de badge "nog geen account".
82. Probeer jezelf op inactief of niet-beheerder te zetten.
    **Verwacht:** dat wordt geweigerd — vangnet tegen jezelf buitensluiten.
83. Ga terug naar de Pro-app (opnieuw inloggen) → ZZ Test 31-07.
    **Verwacht:** de artikelen die de klant toevoegde staan er, herkenbaar als
    door de klant aangemeld, en het afgevoerde artikel staat als afgevoerd.

---

## Fase 10 — Offline (±10 min, op de telefoon)

84. Pro-app → **Offline downloads** → download ZZ Test 31-07.
    **Verwacht:** een pincode-vraag (of hij vraagt je bestaande pin), daarna
    "gedownload" met een tijdstip.
85. Zet je telefoon op vliegtuigmodus en open de app.
86. Ga naar ZZ Test 31-07.
    **Verwacht:** klant, artikelen, sets en medewerkers zijn zichtbaar na het
    ontgrendelen met de pin; geen kale foutmelding.
87. Start een keuring, zet twee artikelen op Goed en rond af.
    **Verwacht:** "Keuring afgerond, offline opgeslagen. Het certificaat wordt
    gegenereerd zodra er weer verbinding is." Onderin een syncbalk met "nog niet
    gesynchroniseerd".
88. Zet vliegtuigmodus uit en wacht (of gebruik de sync-knop).
    **Verwacht:** de syncbalk loopt leeg, en daarna staat het certificaat er echt
    bij de klant.

---

## Fase 11 — Instellingen kort langs (±10 min)

89. Instellingen → **Afkeurcodes**: voeg een code toe en zet er één op inactief.
    **Verwacht:** de nieuwe code komt terug in de keuring; de inactieve niet.
90. **Certificaat-template**: wijzig de voettekst en bekijk het voorbeeld.
    **Verwacht:** het voorbeeld verandert mee.
91. **Keurmeesters**: open je eigen kwalificatie en zet **Zichtbaar bij
    verificatie** aan.
    **Verwacht:** op de verify-pagina uit stap 48 staan nu je kwalificaties met
    "Bekijk bewijs →". Zet je hem uit, dan zijn ze daar weg.
92. **Vindbaarheid**: controleer de listed-schakelaar en de locatie.
    **Verwacht:** Safety Green staat op de kaart met Elst als plek.
93. **Wachtwoord**: wijzig je wachtwoord en log opnieuw in.
    **Verwacht:** inloggen met het nieuwe wachtwoord werkt.
94. Log uit en klik op het inlogscherm **Wachtwoord vergeten**.
    **Verwacht:** een reset-mail die op de reset-pagina landt (niet in de
    klant-app), waar je een nieuw wachtwoord kunt zetten.

---

## Optioneel — alleen als je er tijd of zin voor hebt

95. **Keuring aanvragen (leadmotor).** `/portal/` → zelf beginnen (weer een
    ongebruikt e-mailadres) → materiaal invoeren → keuring aanvragen via de kaart
    of naam-zoeken. Dan in de Pro-app → Aanvragen → goedkeuren.
    **Verwacht:** de klant is gekoppeld en zijn historie is zichtbaar.
96. **Excel/CSV-import.** Instellingen → Excel/CSV-import met een klein
    testbestand (5 regels) op ZZ Test 31-07.
    **Verwacht:** voortgang per rij, `*` in de Goed-kolom telt als goedgekeurd, en
    een standaard volgende-keuringsdatum van +12 maanden. Verwijder daarna de
    batch via "Eerdere imports".
    **Verwacht:** de keuringen zijn weg; de artikelen blijven bewust staan.
97. **Platform-admin.** Instellingen → Bedrijven en Hero-foto (alleen zichtbaar
    met het platform-account `info@gearonimo.net`).
    **Verwacht:** een bedrijf aanmaken/bekijken werkt, "Wachtwoord instellen"
    werkt (migratie 20260748), en een nieuwe hero-foto met de drie crops komt in
    beide apps terug.

---

## Na de test

- **ZZ Test 31-07 mag blijven staan.** Verwijderen lukt niet meer nu er een
  keuring en certificaat aan hangen — dat is opzet (historie blijft bewaard) en
  je krijgt daar een nette melding over. Hij stoort verder niet.
- **Het klant-testaccount** (`+klanttest`) mag ook blijven; het hangt alleen aan
  de testklant.
- **Terugkoppelen:** geef per fase door welke stapnummers ❌ waren en wat je zag.
  Alles wat ✅ is hoef je niet te melden.

---

## Wat dit plan bewust niet test

- **Meer dan 1000 artikelen bij één klant** — de offline-download kapt daar nog
  stil af (bekend punt in `packages/core/src/offline/download.ts`, nog te
  repareren). Met een testklant van 3 artikelen kom je daar niet aan; vertrouw
  offline nog niet bij een klant met een heel groot bestand.
- **Overstap tussen keurbedrijven** — vraagt een tweede keurbedrijf en is
  niemands dagelijkse pad.
- **Stripe, app stores, Engelse vertaling** — bewust uitgesteld naar fase 5.
