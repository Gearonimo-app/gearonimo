# Bouwplan Gearonimo

Hoort bij `BLAUWDRUK.md`, `DATAMODEL.md`, `UX-FLOW.md` en
`ONDERZOEK-CERTIFICAATEISEN.md`. Status: vastgesteld 2026-06-12.

---

## Voortgang (bijgewerkt 2026-07-31, deel 3)

> **App-iconen en splashscreen op het echte logo (Jos 2026-07-31).** Bij het
> opstarten van de PWA kwam een blokkerig grijs plaatje in beeld. Oorzaak:
> `public/icons/icon.jpg` — één JPEG van 320x342 die in het manifest zowel als
> 192x192 als 512x512 stond aangemeld. Android geloofde die maten, blies de
> bitmap op naar splashscreen-formaat, en JPEG kan geen transparantie dus er
> zat ook een wit blok omheen. Het bestand was bovendien niet vierkant.
> - Jos leverde het echte logo aan (groene karabiner + vinkje, woordmerk
>   eronder, 1024x1024 JPEG op wit). Staat als bron in `tools/logo/`.
> - `tools/logo/genereer-iconen.py` maakt daar alle maten uit: witte
>   achtergrond weg via een vulling vanaf de rand (glansplekken op de
>   karabiner zijn óók bijna wit, maar die zitten ingesloten en blijven staan),
>   woordmerk eraf, vierkant uitgelijnd, opgeslagen als 256-kleuren-PNG.
>   Pillow is de enige afhankelijkheid en staat bewust niet in `package.json`:
>   dit is handwerk bij een nieuw logo, geen buildstap.
> - Nieuw: `icon-192.png`, `icon-512.png` (transparant),
>   `icon-maskable-512.png` (dekkend, beeld binnen de veilige zone — Android
>   snijdt daar zelf de themavorm uit), `apple-touch-icon.png` (dekkend, want
>   iOS maakt transparantie zwart) en `favicon-64.png`.
> - **Woordmerk zit bewust niet in het app-icoon**: op 48px in de appdrawer is
>   "Gearonimo" toch onleesbaar en het maakt de karabiner alleen kleiner. Het
>   volledige logo mét woordmerk staat transparant klaar als
>   `tools/logo/gearonimo-logo-transparant.png` voor gebruik ín de app
>   (inlogscherm, certificaat) — nog nergens ingehangen.
> - `background_color` blijft `#ffffff`. Overwogen om er merkgroen of de
>   donkere hero-kleur van te maken, maar de tekening heeft eigen donkere
>   contouren en witte glans en staat op groen juist vlakker.
> - De klant-app had helemaal geen icoon; die krijgt nu favicon +
>   apple-touch-icon (relatieve paden, want hij draait onder `/portal/`).
>   Bewust géén manifest of service worker daar — dat is een eigen besluit.

## Voortgang (bijgewerkt 2026-07-31, deel 2)

> **Statkaart van het hoofdmenu af (besluit Jos 2026-07-31).** De grote kaart
> met "artikelen te herkeuren binnen 30 dagen" stond te prominent voor wat hij
> zei. Hij telt alleen artikelen waarvan de laatste áfgeronde keuring een
> `next_due` binnen 30 dagen heeft — alles wat net geïmporteerd maar nog niet
> gekeurd is telt voor niets, en wat je nú keurt krijgt een datum ruim een jaar
> vooruit. Structureel dus nog niet gevuld.
> - Overwogen alternatieven (klanten / certificaten / concept-keuringen als
>   rij van drie, of tellers als badge op de tegels). **Besluit Jos: voorlopig
>   niets terugplaatsen** — "dat past meer in de schone flow die ik voor ogen
>   heb; we plaatsen niks terug totdat we hiervoor verzoekjes krijgen."
> - Let op bij een eventuele terugkeer: `certificates.inspection_id` is uniek,
>   dus "aantal certificaten" is hetzelfde getal als "aantal afgeronde
>   keuringen ooit". En er is geen overzichtsscherm met alle certificaten, dus
>   dat getal heeft nu nergens om naartoe te klikken.
> - `Home.vue`: statkaart + `upcoming_reinspections_count`-aanroep weg,
>   `home.reinspectionStatLabel` uit beide locales. De badge met openstaande
>   aanvragen op de tegel Aanvragen blijft.
> - Desktop-indeling herzien: zonder de kaart ernaast stonden de 6 tegels als
>   een smal 2x3-kolommetje op 170px; nu 3x2 op 200px, gecentreerd.
> - **De databasefunctie `upcoming_reinspections_count` blijft staan** — geen
>   migratie, en zo is de teller later zonder werk terug te halen.

## Voortgang (bijgewerkt 2026-07-31)

> **Werk-tabbladen in de keurmeester-app (wens Jos 2026-07-31):** "wanneer ik
> een certificaat of klant open is dat het enige tabblad dat open is -- als ik
> tijdens een keuring of het koppelen van artikelen een klant wil toevoegen of
> naar de catalogus wil, moet ik stoppen met waar ik mee bezig was." De app
> draait nu als een mini-browser: meerdere pagina's tegelijk open, elk met een
> eigen levende staat.
> - `composables/useTabs.ts` — de gedeelde bron. Houdt de tabbladen bij, hangt
>   zichzelf aan `router.afterEach` en levert de keep-alive-sleutel
>   `tabId|fullPath`. Die sleutel is het hart van het geheel: twee tabbladen op
>   dezelfde pagina krijgen elk een eigen instantie, en binnen één tabblad naar
>   een andere klant gaan geeft een vérse component (de pagina's lezen
>   `route.params` één keer bij setup — zonder verse sleutel zou klant 2 de
>   gegevens van klant 1 tonen). De sleutel wordt alléén in `afterEach` gezet,
>   nooit uit (activeId, route) berekend: anders bestaat er tijdens een
>   navigatie een tussenstand die keep-alive een wegwerp-instantie kost.
> - `components/TabBar.vue` — de strook bovenin (vast, `position: fixed`, dus
>   de bestaande paginahoogtes blijven ongemoeid). Actief tabblad loopt
>   visueel over in de kopbalk eronder; plus-knop opent een nieuw tabblad op
>   het hoofdmenu; het laatste tabblad kun je niet sluiten. Schuift horizontaal
>   op een telefoon en scrolt het actieve tabblad in beeld. Max 8 tabbladen.
> - **Namen van de tabbladen komen uit `AppHeader`**: dat component kent als
>   enige de echte paginatitel ("Acme Klimhal B.V.", "Keuring 12-03"). Het
>   meldt die mét het tabblad-id dat bij setup is vastgelegd — een pagina in
>   een áchtergrond-tabblad leeft door, dus zonder id zou een klantnaam die
>   later binnenkomt op het verkeerde tabblad landen.
> - **Eén bron voor de hoogte**: `--tabbar-h` (0 op de schermen zonder strook)
>   en `--page-min-h` in `style.css`. De 16 pagina's gebruiken
>   `min-height: var(--page-min-h, 100vh)` en `AppHeader` plakt op
>   `top: var(--tabbar-h)`. Geen `!important`, geen losse getallen.
> - `composables/onReactivated.ts` — `onReactivated` (lijsten opnieuw laden als
>   je terugkomt op een tabblad; anders staat de klantenlijst in tabblad A
>   eeuwig verouderd nadat je in B een klant toevoegde) en `useViewVisible`
>   (watchers op de gedeelde route uitzetten zolang een tabblad niet in beeld
>   is — anders veranderde de artikelpagina in het ándere tabblad mee).
> - Tabbladen overleven een herlaad via `sessionStorage` (de strook komt terug,
>   de staat ín de pagina's niet — dat kan niet anders), en worden gewist bij
>   uitloggen. Losstaande schermen (inloggen, wachtwoord, publieke verificatie)
>   krijgen `meta: { noTabs: true }`: geen strook, geen keep-alive.
> - **Correctie tijdens dezelfde sessie (vraag Jos: "kan ik tijdens artikelen
>   koppelen nog wel naar het volgende artikel klikken?").** De watcher op
>   `route.params.id` in `ArticleDetail.vue` is nu wég in plaats van
>   voorwaardelijk. Hij was niet alleen overbodig (de keep-alive-sleutel bevat
>   het pad, dus elk artikel krijgt een verse component) maar ook schadelijk:
>   een watcher draait vóór de DOM-update, dus de wegklikkende pagina laadde
>   nog snel het nieuwe artikel in en werd daarna in díe staat bewaard onder
>   haar oude sleutel — terug (of een ander tabblad) toonde dan het verkeerde
>   artikel. Doorklikken loopt gewoon via `goTo()` -> `router.push`.
> - Daarbij hoort een **buurlijst-cache op moduleniveau** in `ArticleDetail`:
>   zonder de watcher zou doorlopen door 278 geïmporteerde artikelen 278 keer
>   de hele lijst ophalen. De cache deelt bewust dezelfde array met `siblings`,
>   zodat het bijwerken van `product_id` bij koppelen/ontkoppelen meegaat en
>   "volgend vrij artikel" blijft kloppen; hij wordt gewist bij
>   afvoeren/terugzetten/wissen.
> - **Geverifieerd met een tijdelijk testscherm** (7 scenario's, daarna weer
>   verwijderd): doorklikken naar het volgende artikel toont het nieuwe artikel
>   met schone staat, terug toont het oude artikel mét zijn eigen staat, en
>   twee tabbladen op een artikelpagina beïnvloeden elkaar niet.
> - Geen migratie nodig; de klant-app is niet gewijzigd.

## Voortgang (bijgewerkt 2026-07-31, catalogus)

> **Audit na een terechte zorg van Jos (2026-08-04).** Hij zag dat de EDELRID
> TREEREX II als `no_ppe` stond terwijl het een klimgordel is: *"ik maak me
> ernstige zorgen om de database. Als dit soort fouten erin kunnen kruipen, wat
> klopt er dan nog meer niet?"*
> - **Het waren er 27**, niet één: 16 Teufelberger treeMOTION-gordels, 6 STEIN
>   VEGA-gordels, 5 EDELRID (TREEREX II + vier voetklemmen). Allemaal met
>   EN 361, EN 813, EN 358, EN 567 of EN 12841 in de norm. Gecorrigeerd naar
>   `ppe`.
> - **Nieuwe controleregel maakt dit voortaan onmogelijk**: draagt een product
>   een norm die per definitie PBM is, dan kan het geen `no_ppe` zijn. Zie
>   `PPE_NORMEN` in `packages/core/src/catalog.ts` (20 normen), met vijf tests.
>   EN 795 en EN 12278 zitten er bewust níét in: ankers en katrollen komen
>   legitiem in beide regimes voor.
> - **Vier andere controles gedraaid, uitkomst geruststellender dan het klinkt:**
>   levensduur gebruik > fabrikant: 0 gevallen. Dubbele artikelcodes: 29, maar
>   28 daarvan zijn maatvarianten die terecht een basiscode delen; **één echte
>   fout**: EDELRID `852060000060` staat op zowel `D-CLASSIC 3000 SCREW` als
>   `OVAL POWER 2500 SCREW`. 35 producten waarvan naam of categorie draagbaar
>   klinkt maar die geen `ppe` zijn — nagelopen en vrijwel allemaal terecht
>   (voetlussen, klimsporen, gereedschapslijnen, `Magneato` met "NOT for life
>   support"). Twee twijfelgevallen voor Jos: **Teufelberger `upMOTION SRT`
>   (2 maten, categorie Harnesses, geen norm)** en **Climbing Technology
>   `SEAT TEC` / `HOOK REST`**.
> - **Grootste resterende gat: 108 producten met `product_type=ppe` maar geen
>   enkele norm.** Vooral Courant (26), STEIN (11), Rope Logic (10), Notch (9),
>   ART (8), Rock Exotica (8), Yale (8). Daar kan de nieuwe regel niets mee —
>   geen norm betekent geen tegenspraak om op te vangen.
> - **TREEREX II gesplitst in drie maten** (2026-08-13, schermafdruk Edelrid):
>   `size 0`, `size 1`, `size 2`. De bestaande regel is `size 1` geworden zodat
>   de id — en daarmee gekoppelde klantartikelen — behouden blijft; 0 en 2 zijn
>   nieuw. Zelfde aanpak als bij Quick Cinch en Phoenix.
>   - **Alleen maat 0 heeft een artikelcode** (`820250132190`): die stond op de
>     pagina terwijl SIZE 0 geselecteerd was. De codes van maat 1 en 2 zijn niet
>     bekend en dus leeg gelaten — niet afgeleid.
>   - Opgemerkt, niet aangepast: Edelrid noemt het product **"Sit Harnesses"**,
>     bij ons staat categorie `Harnesses`. Klopt met de EN 813 in de norm.
>   - Ander openstaand punt uit de audit: `FLEX LITE size 1` en `size 2` delen
>     één artikelcode (`820390142170`). Bij maatvarianten kán dat kloppen, maar
>     gezien de TREEREX per maat een eigen nummer heeft is dat twijfelachtig.

> **Merkoverzicht gemaakt (2026-08-04, vraag Jos "welke merken moeten we
> nog?").** 43 merken, 2635 producten. Twee concrete gebreken gevonden, nog
> niet gerepareerd:
> - **`Kratos` (15) en `Kratos Safety` (1) zijn hetzelfde merk** — zelfde site
>   `kratossafety.com`, zelfde codeformaat `FA…`. Splitsing betekent dat een
>   keurmeester die op "Kratos" zoekt niet alles ziet.
> - **13 producten hebben een artikelcode als naam** in plaats van een
>   omschrijving: CMI 6 van zijn 7 (`RP130`, `RP131`, `RP145`, `RP146`, `RP160`,
>   `RP162`), TreeUP 4 (`P-71E`, `P-90`, `P-90mX`, `TH-020`), plus
>   `Kratos Safety fa4090220`, `Climbing Technology SKR-2` en `Samson V-24`.
>   Onbruikbaar in een lijst: de keurmeester ziet geen product maar een code.
> - **Dunne merken die vermoedelijk onvolledig zijn**: ASAT 1, SOVOS 1,
>   BASHLIN 4, Distel 4, RIGIQ 5, Haberkorn 6, CMI 7, Tendon 9, CAMP 11,
>   Rope Logic 11, Kratos 15, Tango 15, Husqvarna 18, Samson 19.
> - **Merken mét volume maar zonder handleidingen**: Courant 100 producten (0%),
>   Kask 58 (0%), Ellersafe 36 (0%), Beal 32 (0%), Samson 19 (0%),
>   Rock Exotica 60 (2%), Tree Runner 63 (2%). Yale Cordage heeft 189 producten
>   zonder één artikelcode.

> **Ellersafe erbij (2026-08-04): 36 producten, 0 fouten.** Harnassen,
> vanglijnen/valdempers en valstopapparaten. Ingevoegd zoals aangeleverd, met
> vier gaten die Jos moet wegen:
> - **Geen enkele handleiding-link** (`manual_url` leeg bij alle 36). Voor PBM
>   is dat het veld waar de keurmeester de fabrikantsinstructie opent.
> - **18 van de 36 wijzen als "productpagina" naar dezelfde
>   heyzine-flipbook-PDF** (`cdnm.heyzine.com/flip-book/…-4.pdf`, pagina 4 van
>   één catalogus). Dat is verkoopmateriaal, geen productpagina — en één
>   gedeelde link zegt niets over het specifieke product. 14 wijzen wél naar
>   `ellersafe.com`.
> - **4 wijzen naar wederverkopers** (licht-produktiv.de, sos-shop.com,
>   prolight.co.uk, riggersworld.eu). Die verdwijnen zodra de winkel het artikel
>   uit het assortiment haalt.
> - **Geen levensduur** (`max_age_use_years` en `max_age_mfr_years` allebei 0/36
>   gevuld). Bij harnassen en valstopapparaten stuurt dat de afkeurdatum.
> - **Merk uit de naam gehaald** (akkoord Jos): alle 36 begonnen met
>   "ELLERsafe", terwijl de app merk en naam samen toont — dus stond het dubbel.
>   In de rest van de catalogus is dat zeldzaam (42 van 2599, vrijwel alleen
>   PROTOS). Gedaan vóór de import, toen de rijen nog geen id hadden, zodat het
>   geen extra bijwerkronde kostte. Geen botsingen na het inkorten.
>   - 13 namen beginnen nu met een kleine letter ("Ellersafe valstopapparaat
>     CR030"). Dat is correct Nederlands en sorteert goed; niet aangepast.
>   - Wel opgevallen: de naamgeving in dit bestand is gemengd — sommige beginnen
>     met de modelcode (`H110 harness`), andere met de productsoort
>     (`valstopapparaat CR030`). Dat zat al in de aangeleverde lijst. De codes
>     staan sowieso in `manufacturer_code` en zijn dus doorzoekbaar; gelijk
>     trekken kan als Jos dat wil.

> **Opmerking altijd zichtbaar, en de lus rondgemaakt (2026-08-02).**
> - **`notes` staat nu gewoon in beeld tijdens de keuring**, niet meer achter
>   een ℹ️-knop met tooltip. Correctie van Jos: *"ik wil opmerkingen gewoon
>   kunnen lezen. Een afwijkende lengte lijn bijvoorbeeld staat daar. Recalls en
>   inspection notice is de plek voor veiligheidswaarschuwing."* Terechte
>   scheiding: een vlag vraagt om een beslissing, een opmerking is context bij
>   het artikel en moet je kunnen lezen zónder te weten dát er iets staat.
>   Kost niets: 1% van de producten heeft een opmerking, mediaan 28 tekens.
>   Knop, tooltip-helper en de bijbehorende i18n-sleutel zijn verwijderd.
> - **Verse export van 2026-08-02 nagelopen tegen de bronlijst.** Nul producten
>   ontbraken, nul fouten in de export. Wel **39 diameterverschillen die geen
>   verschil waren**: `11.00` hier tegen `11` in Gearonimo, `11.50` tegen
>   `11.5`. De database bewaart `rope_diameter_*` als `numeric` en geeft dus een
>   eigen schrijfwijze terug. `toCatalogRow()` normaliseert die twee kolommen nu
>   naar dezelfde vorm, anders meldt `--sinds=` bij elke ronde 39
>   spookwijzigingen. Alleen voor `numeric`-kolommen — `max_user_weight_kg` mag
>   "130-150" blijven.
> - **De 296 nieuwe producten hadden hier nog geen `id`.** Die kent Gearonimo
>   pas bij het importeren toe. Opgelost door de verse export gewoon te
>   ingesten: die matcht op merk+naam en vult de id aan. Nu 2598 van 2598 mét
>   id, dus voortaan kunnen ze ook bijgewerkt worden in plaats van alleen
>   toegevoegd.
> - **Stand: bronlijst en database lopen gelijk**, nul openstaande wijzigingen.
> - **`Tree Runner General Purpose Rope 12 mm` blijft toch staan** (besluit Jos
>   2026-08-02, draait het besluit van 2026-07-31 terug): *"dit is een veel
>   verkochte lijn maar heeft geen normering. Ik kom hem heel af en toe tegen.
>   Ik heb er geen moeite mee dat deze erin staat."* Een lijn die je in het veld
>   tegenkomt hoort vindbaar te zijn, ook zonder normering — anders belandt hij
>   als vrij artikel in de wachtrij. Uit de verwijderlijst gehaald zodat een
>   volgende ronde hem er niet alsnog uit gooit; die staat nu op 5 producten,
>   allemaal gedaan.
>   - Jos had het producttype in de app zelf al op `no_ppe` gezet (stond op
>     `ppe`), wat klopt bij "geen normering". Dat kwam via zijn export mee.
> - **Alle zes verwijderingen zijn daarmee afgerond**: vijf weggehaald, één
>   teruggedraaid.

> **Import gedraaid (2026-08-01, 16:40).** Jos heeft het gebundelde bestand van
> 456 rijen in Gearonimo geïmporteerd. De preview van de wizard meldde
> **"296 new, 160 updated, 0 already present (skipped), 0 failed"** — exact wat
> de nabootsing van `buildPreview()` vooraf voorspelde. De bronlijst in de repo
> en de database liepen daarmee weer gelijk.
> - Nog te doen door Jos: de zes handmatige verwijderingen (de import kan dat
>   niet) en daarna een verse export uit de app, zodat `catalog:export --sinds=`
>   een nieuw ijkpunt heeft.

> **ISC: artikelcode in de omschrijving (2026-08-01).** Wens Jos: *"isc pulleys
> ik wil dat de RP-nummer in de omschrijving staat"* — de code staat op het
> product gegraveerd en de handel noteert hem zo ("ISC COMPACT RIGGING PULLEY
> 14 MM RP248A1"), maar bij ons stond hij alleen in `manufacturer_code`. Bij 79
> ISC-producten met een RP-code is die nu achteraan de naam gezet
> (`200-Series Compact Rigging Pulley RP248`). Bewust niet alleen katrollen: de
> RP-reeks omvat ook o.a. `A-B Descender RP810`, en een half doorgevoerde
> naamafspraak is later lastiger dan een hele.
> - **Uitgebreid naar alle 134 ISC-producten** (2026-08-01, na *"bij ISC alles,
>   ook de KH bij carabiners"*): naast de 79 RP-codes ook KH (19, karabiners),
>   SH (8), KL (8), RT (5), UB (4), GG, RIN en enkele losse. Geen ISC-product
>   heeft nu nog een code die alleen in `manufacturer_code` staat.
> - **Zoeken verdraagt nu één tikfout per woord (2026-08-01).** Jos zocht
>   "Save vision static line" (Save i.p.v. Safe) en kreeg EDELRID Fast Saver en
>   Cambiumsaver. Oorzaak: bij nul treffers haalt `fuzzySearch` het **laatste**
>   woord eraf en houdt dus het eerste over — precies het woord met de fout,
>   terwijl vision, static en line alle drie klopten. Jos: *"ik vind het stom
>   dat een kleine typefout alles tegenhoudt."*
>   - `matchtWoord()` accepteert een zoekwoord nu ook als prefix mét één
>     afwijking (vervangen, invoegen of weglaten). Geen volledige Levenshtein
>     maar een goedkope "hoogstens één bewerking"-check, want dit draait per
>     toetsaanslag over ±2600 producten. Gemeten op de echte catalogus: 8–54 ms.
>   - **Grens bij vier tekens**: korter krijgt géén marge, anders vindt "ok" ook
>     "ak" en juist korte tokens zijn hier vaak acroniemen ("tl" → TriactLock)
>     die exact horen te matchen. Gevolg dat je moet weten: een tikfout in een
>     kort woord wordt niet gecorrigeerd.
>   - `matchTokens()` geeft nu het mínimum aantal benodigde correcties terug in
>     plaats van een ja/nee; per correctie gaat er 100 van de score af, zodat
>     een exacte match altijd boven een gecorrigeerde blijft staan.
>   - Zes tests erbij (17 totaal). Nagelopen op de echte catalogus: "ok tl",
>     "petzl seq", "RP248" en "big dan kh" doen het onveranderd.
> - **Vermoeden van Jos over de te verwijderen `Small Forged Pulley 20mm`
>   (RP051-20) nagelopen.** Zijn gok was dat dit stiekem een compact rigging
>   pulley uit zijn schermafdruk is. Dat lijkt niet te kloppen: die twee
>   (RP248 14 mm, RP251 16 mm) stáán al in de catalogus als 200-Series, en
>   passen niet op "20 mm" of "forged". Een 20 mm gesmede ISC-katrol bestaat
>   wél: `Medium Forged Pulley 20mm RP055`, ook al aanwezig. De verwijdering van
>   RP051-20 blijft daarmee terecht — er raakt geen bestaand product zoek —
>   maar dat is Jos' laatste woord.
> **Courant Phoenix rope sling op lengte gezet (2026-07-31).** Jos leverde een
> schermafdruk van de productpagina van Courant met de lengtekeuze. De
> bestaande regel `Phoenix rope sling` had geen lengte; die is hernoemd naar
> `0.65 m` (id blijft, dus gekoppelde klantartikelen raken niet los — zelfde
> aanpak als bij de Notch Quick Cinch) en er zijn zes lengtes bijgekomen:
> 0.75, 0.80, 0.85, 0.90, 1.00 en 1.10 m. Alle overige gegevens gekopieerd van
> de bestaande regel (ppe, Hitch Cords, aramide mantel, 8 mm, 10 jaar).
> - **Aanname om na te kijken:** een artikel dat eerder aan de lengteloze regel
>   hing, hangt nu aan de 0.65 m-variant.
> - **0.70 m alsnog toegevoegd:** de lijst op de schermafdruk was doorgescrold
>   (bevestigd door Jos), waardoor 0.65 en 0.70 er bovenaan uit vielen. Acht
>   lengtes nu: 0.65 t/m 1.10 m.
> - **Materiaal op alle 10 Phoenix-producten** naar
>   `Aramid/polyester blended sheath`, conform de fabrikantstekst *"gaine
>   mélangée aramide/polyester"*. Stond overal als `Aramid sheath`.
> - **Opgelost met vijf schermafdrukken van Courant (2026-07-31, 20:14).** De
>   fabrikantstekst is eenduidig: *"available in 8mm or 10mm diameter as a
>   lanyard with 2 stitched eyes from 65cm up to 110cm"*. De acht lengteregels
>   stonden dus onder de verkeerde naam (`Phoenix rope sling`) én bij maar één
>   diameter. Nu **16 regels**: `Phoenix 8mm/10mm Hitch Cord <lengte> m`, met
>   `notes` = "Lanyard met 2 gestikte ogen". De zeven overbodige rope
>   sling-regels zijn verwijderd; de 0.65 m behield zijn id via een hernoeming,
>   zodat gekoppelde klantartikelen niet losraakten. 1.10 m is bevestigd als de
>   langste, 0.65 m als de kortste.
> - **Artikelcodes: `MNKNL` = 8 mm, `MPKNL` = 10 mm, achtervoegsel `C`.** De
>   lengtecode ertussen wisselt van eenheid: hele decimeters krijgen het aantal
>   dm met voorloopnul (`0.70` → `07`, `0.80` → `08`, `1.00` → `10`, `1.10` →
>   `11`), de rest de lengte in centimeters (`0.65` → `65`, `0.75` → `75`).
>   **Zes codes zijn van een productpagina gelezen** (`MPKNL65C`, `MPKNL07C`,
>   `MNKNL07C`, `MNKNL75C`, `MNKNL08C`, `MNKNL10C`), de lengtecode `11` gaf Jos
>   op, de overige tien zijn afgeleid van dat patroon. Per regel vastgelegd in
>   de kolom `bron_artikelcode` van
>   `catalog/inbox/2026-07-31_besluit-phoenix-lanyards.csv`; die kolom wordt
>   niet geïmporteerd. De afgeleide codes zijn **door Jos bevestigd**
>   (2026-07-31): *"het klopt gewoon"*. Geen openstaande vraag meer.
> - **De regels zónder lengte blijven staan, en dat is bewust.** Dat zijn de
>   rope boxes; *"zonder lengte wordt door de verkoper opgedeeld, dat kan een
>   keurmeester zelf aanvullen"* (Jos 2026-07-31). Ze horen dus géén lengte te
>   krijgen en zijn geen onvolledige regel — niet "opruimen" in een volgende
>   sessie.

> **Sessie 2026-07-31 — de bronlijst staat voortaan in de repo.** Melding Jos:
> *"ik merk dat veel data verloren gaat in slechte administratie aan mijn kant.
> ik heb nu vele bestanden en ben het overzicht kwijt"*, met de vraag of Claude
> de database niet zelf online kan bijhouden.
>
> - **Online bijhouden kan niet, en dat is niet op te lossen met een truc.** De
>   sessie komt niet bij Supabase: de netwerkpolicy van de omgeving weigert
>   `buitfeiclivzzldfdelp.supabase.co` (`403 to CONNECT`). En de enige sleutel
>   in de repo is de publieke anon-sleutel, die de catalogus alleen mag lezen —
>   bewerken vereist een ingelogde curator. Wil Jos dit alsnog, dan zijn er
>   twee dingen nodig: de host openzetten in de netwerkpolicy én een
>   `service_role`-sleutel als secret. Die sleutel omzeilt álle RLS (dus ook
>   klantdata), daarom niet stilzwijgend gedaan — **openstaand besluit voor
>   Jos.**
> - **De echte oorzaak zat elders:** er stond geen enkel catalogusbestand in
>   git. De catalogus van 2294 producten bestond alleen als losse bestanden in
>   een chatproject en als rijen in de live database. Vandaar ook de redenering
>   bij de reset van 2026-07-28 ("er gaat geen echte data verloren, die staat
>   elders ook") — er was geen plek waarvan vaststond dát het de laatste versie
>   was. Online toegang had dat niet opgelost, alleen versneld.
> - **`catalog/producten.csv` is nu de bron**, in git. CSV en geen Excel: een
>   `.xlsx` is een zipbestand waar git alleen "gewijzigd" van ziet, terwijl een
>   CSV per regel te vergelijken is — `git diff` toont dus wélk product
>   veranderde. Excel blijft aan de uiteinden: aanleveren mag in Excel,
>   terugleveren gebeurt in Excel. Ruwe aangeleverde bestanden blijven bewaard
>   in `catalog/inbox/`.
> - **Drie scripts** (`npm run catalog:ingest` / `:check` / `:export`),
>   geschreven in TypeScript en rechtstreeks door Node gedraaid — Node 22 strip
>   types zelf, dus geen bouwstap en geen nieuwe afhankelijkheid. De Excel gaat
>   door SheetJS, dezelfde bibliotheek als de app, en is nagelopen met een
>   nabootsing van `buildPreview()`: bladnaam `Catalogus`, alle 22 kolommen,
>   0 fouten.
> - **De regel die data redt: een lege cel wist niets.** Een aangeleverde lijst
>   met alleen merk, naam en handleiding-link laat breuksterkte en levensduur
>   staan. Zonder die regel veegt elk gedeeltelijk lijstje stil de rest leeg —
>   precies hoe hier eerder werk verdween. Het rapport meldt wél hoe vaak het
>   gebeurde. Wissen kan expliciet met `--overwrite`.
> - **De controle houdt tegen wat eerder echt misging**: dubbelen op merk+naam
>   (de 5699-in-plaats-van-2294-ronde), een categorie in `product_type` (de
>   stille GB-bug: onbekende waarde → terugval op 12 maanden terwijl PBM daar
>   op 6 moet), tekst in een getalveld (wordt bij import geruisloos `null`),
>   ontbrekend merk/naam, en onbekende kolommen. Ruim gelaten waar het hoort:
>   `max_user_weight_kg` als tekst, `999` als onbeperkte levensduur.
> - **Gedeelde bron `packages/core/src/catalog.ts`** (18 tests): kolomlijst,
>   producttypes en `productKey` stonden op drie plekken los van elkaar.
>   `CatalogManager.vue` en `ProductForm.vue` gebruiken ze nu vandaar.
> - **Losse NUL-byte uit `CatalogManager.vue`.** Het scheidingsteken in
>   `productKey` stond als echte NUL-byte in het bestand, waardoor git het als
>   binair telde en `git diff` er niets van liet zien. Nu als escape (`\0`) —
>   gedrag identiek, bestand weer gewoon tekst en vergelijkbaar.
> **CT-connectoren binnen (2026-07-31).** Vraag was of Claude ze online kon
> opzoeken. Dat lukte niet: de omgeving laat geen uitgaand verkeer toe —
> `climbingtechnology.com`, `grube.eu`, `petzl.com` en zelfs Wikipedia geven
> `403 to CONNECT`, ook op de PDF-link die Jos daarna stuurde. Alleen de
> zoekfunctie werkt (server-side), en die leverde bewijs van haar eigen
> onbetrouwbaarheid: Q-Link en Hook It kregen woordelijk dezelfde omschrijving,
> terwijl het twee verschillende karabiners zijn.
> - Jos leverde daarop `CT_producten.csv` aan: **223 rijen, 0 fouten, 0
>   waarschuwingen** — 72 connectoren, 52 lanyards, 37 harnassen, 21
>   touwklemmen, 14 katrollen, 12 helmen, 9 valstoppers, 6 afdaalapparaten.
>   189 waren nieuw (de 34 harnassen van eerder stonden er al identiek in).
> - **De zoeklijst bleek precies zo onbruikbaar als gevreesd.** Zoekresultaten
>   gaven "Pillar" en "Axis HMS"; in werkelijkheid zijn dat `PILLAR PRO SG`,
>   `PILLAR PRO SGL`, `AXIS HMS SG`, `AXIS HMS SGL` — het achtervoegsel is het
>   sluitingstype (SG/TG), juist wat een keurmeester onderscheidt. Eén "Pillar"
>   uit de zoeklijst = 12 echte producten. Twee gezochte namen ("Support",
>   "Large Steel TGB ANSI") komen in de fabrikantslijst niet voor.
> - **Les:** zoekresultaten zijn bruikbaar om te weten *dát* er iets is, nooit
>   om te weten *wat* het is. Voor catalogusdata blijft de fabrikantsbron nodig.
>   Wil Jos dit wél zelf laten ophalen, dan moet de netwerkpolicy van de
>   omgeving fabrikantensites toelaten — openstaand.
>
> **Besluiten Jos 2026-07-31, tweede ronde (na het aanleveren van vier
> bestanden):**
> - **Tractel: 20 jaar vanaf productiedatum.** 84 van de 94 stonden al zo; de
>   10 lege zijn bijgezet. Het aangeleverde Tractel-bestand had daar `999`
>   (onbeperkt) staan — dat is dus níét overgenomen.
> - **ART voorlopig met rust laten.** Jos heeft mailcontact met ART; die hebben
>   al enkele PDF's op hun site aangepast en wachten zelf nog op iets dat er nog
>   niet is. Pas aanpassen als ART klaar is, *"anders moeten we over 3 weken
>   weer alles aanpassen"*. Dit raakt de 9 ART-producten met lopende tekst in
>   `inspection_notice_url` (o.a. "Textile parts must be replaced after 5
>   years…" en de `FLAG:`-notities bij BlackBird, waaronder een actieve
>   ART-veiligheidsmelding van oktober 2025 over de bearing pin). **Niet
>   opruimen tot Jos het sein geeft** — het ziet eruit als een fout, maar het is
>   een bewuste wachtstand.
> - **`products.notes` is nu zichtbaar tijdens de keuring (2026-07-31).** Bij
>   het nakijken bleek `notes` nul keer voor te komen in `InspectionWizard.vue`:
>   de keurmeester zag dat veld tijdens een keuring helemaal niet, alleen op de
>   artikelpagina. Dáárom belandden fabrikantseisen zónder document in
>   `inspection_notice_url` — een linkveld, dus lopende tekst werd een kapotte
>   link. Keuze Jos: tekst naar `notes`, échte link naar `inspection_notice_url`,
>   én `notes` zichtbaar maken in de keuring.
>   - ℹ️-knop in de vlaggenkolom die de opmerking onder de rij uitklapt
>     (`colspan=12`, zelfde patroon als de groepskop). Uitklappen en geen
>     tooltip: een tooltip vraagt muisaanwijzen en er wordt op een telefoon
>     gekeurd.
>   - Bewust géén ✕ om af te vinken, anders dan bij recall en notice: een
>     opmerking geldt bij élke keuring van dat product, dus verbergen zou de
>     eerstvolgende keurmeester de informatie onthouden.
>   - Neutraal grijs, niet rood/oranje — het is achtergrond, geen waarschuwing,
>     en mag niet concurreren met de recall-vlag. Layout headless gerenderd en
>     bekeken vóór oplevering.
>   - i18n nl+en: `productNotesFlag`, `productNotesTitle`.
> - **Skylotec MILAN verplaatst:** de service-eis staat nu in `notes`,
>   `inspection_notice_url` is leeg. Bij de Kalimba-notitie stond in de leestekst
>   "(zie recall_url)" — een kolomnaam in tekst die een keurmeester leest;
>   vervangen door "(zie de recall-link bij dit product)". Gevonden door de
>   weergave écht te renderen.
> - **ART BlackBird heeft weer een handleiding (2026-08-01).** ART heeft die
>   PDF vernieuwd; Jos leverde de link aan. `manual_url` stond leeg — de
>   `FLAG:`-notitie op dit product meldde al *"official manual link 404 on
>   climb-art.de (both known URLs)"*, dus die is nu opgelost.
>   - Eerst stond er kort een `share.google`-verkorte link in; Jos leverde
>     daarna het echte adres:
>     `climb-art.de/shared-assets/manuals/2025_BED_BB_EU_DRUCK_NEU_NOV.pdf`.
>     Opgeslagen als **https**, niet http zoals aangeleverd: de apps draaien
>     zelf op https (GitHub Pages), dus een http-link wordt door de browser
>     geweerd of als onveilig gemarkeerd. Dat de host https aankan blijkt uit de
>     15 andere climb-art.de-links.
>   - **Mijn gok naar het pad was fout** — ik verwachtte
>     `/wp-content/uploads/2025/11/` (WordPress-jaar/maandmappen). Het is
>     `/shared-assets/manuals/`, precies het pad waar `SpiderJack 2.1` al naar
>     wees. Die afwijking was dus geen uitzondering maar **de nieuwe structuur
>     van ART**. Goede reden dat de gok niet is ingevuld.
>   - **Bruikbaar voor later:** de 15 links naar `/wp-content/uploads/2020/10/`
>     verhuizen vermoedelijk naar `/shared-assets/manuals/`. De bestandsnamen
>     veranderen echter óók (`Manual-X.pdf` → `2025_BED_XX_EU_…pdf`), dus ze
>     zijn niet af te leiden — per stuk aanleveren blijft nodig.
>   - De `FLAG:`-notitie op BlackBird is nu deels achterhaald: het punt
>     "official manual link 404" is opgelost, maar "min user weight 60kg has no
>     column" en de actieve ART-veiligheidsmelding (oktober 2025, bearing pin)
>     staan nog. Niet aangepast — valt onder de ART-wachtstand.
>   - De rest van de ART-site is nog niet aangepast (Jos): de 15 links naar
>     `wp-content/uploads/2020/10/Manual-*.pdf` blijven voorlopig staan. Ook de
>     10 ART-producten zónder handleiding wachten daarop. Checklist met alle 26
>     staat in `catalog/export/art-handleidingen-nalopen-2026-08-01.xlsx`.
> - **Nog te doen: de 9 ART-regels** hebben nog steeds lopende tekst in
>   `inspection_notice_url`. Verplaatsen naar `notes` botst niet met de
>   ART-wachtstand (de PDF-link kan er later gewoon bij), maar Jos' instructie
>   was expliciet "nog even wachten" — dus niet gedaan, vraagt akkoord.
> - **~~Openstaand: Skylotec MILAN.~~ (verplaatst, zie boven)** Die heeft óók lopende tekst in
>   `inspection_notice_url` ("Every 5 years: Level 2 service by authorised
>   Skylotec partner required…") en viel bij de bespreking onder "allemaal van
>   ART", maar is dat niet. Bewust laten staan: het veld toont een vlag aan de
>   keurmeester tijdens de keuring, dus verplaatsen naar `notes` maakt een echte
>   service-eis mínder zichtbaar in plaats van meer. Vraagt een besluit.
>
> **`te_verwijderen.txt` nagelopen (2026-07-31).** Van de 11 regels bleken er
> maar 4 een verwijdering; de rest waren correcties, een terugroepactie en twee
> vragen. Klakkeloos opvolgen zou schade hebben gedaan.
> - **Verwijderd (4):** ISC Small Forged Pulley 20mm (bestaat niet, alleen
>   RP051 @ 16mm bevestigd), Tree Runner General Purpose Rope 12 mm en Webbing
>   Sling (allebei "laten vallen"), Notch Pebble Retrieval System. Besluit +
>   reden staan in `catalog/inbox/2026-07-31_besluit-verwijderen.csv`.
> - **Kalimba-terugroepactie afgehandeld (2026-07-31).** Jos leverde de
>   recall-pagina van Courant aan (schermafdruk; de pagina zelf is niet
>   bereikbaar vanuit de omgeving). Het is een Google-formulier, maar het draagt
>   het volledige recall-bericht van Courant: banner "PRODUCT RECALL — SPLICED
>   KALIMBA", uitleg, en `contact@mycourant.com`. Daarmee is het een betere bron
>   dan de `sherrilltree.com`-link die er stond (een Amerikaanse webshop).
>   - `recall_url` op **alle zeven** regels naar de Courant-pagina. Ook het kale
>     touw: Jos meldt *"echt alles moet terug"*. De vlag zegt "controleer of dit
>     exemplaar eronder valt" en veroordeelt niets, dus te ruim vlaggen kost een
>     keurmeester een halve minuut, te krap vlaggen mist een teruggeroepen touw.
>   - `notes` op alle zeven: actie loopt, **nog geen goedgekeurde vervanging
>     geleverd of verkrijgbaar** (Jos: "dat komt allemaal later pas"), aanmelden
>     via het formulier, VS-klanten apart, contactadres, en "niet goedkeuren
>     tijdens keuring zolang deze actie loopt".
>   - `inspection_notice_url` (de AVIS-PDF van Courant) blijft ongemoeid.
>   - **`status` bewust niet aangeraakt.** Dat veld zit sowieso niet in de 22
>     kolommen van import/export, maar belangrijker: archiveren zou de producten
>     uit de catalogus halen en daarmee juist de recall-vlag weghalen bij de
>     klanten die zo'n touw hebben. Bij een lopende actie wil je ze zichtbaar
>     houden.
> - **~~⚠ Courant Kalimba — NIET verwijderen.~~ (afgehandeld, zie boven)** Actieve terugroepactie (splice
>   niet in orde, alle lijnen inleveren). 7 producten; 6 hebben al een
>   `recall_url`, alle 7 een `inspection_notice_url`. Verwijderen zou juist de
>   recall-vlag weghalen bij klanten die het product hebben — het tegenovergestelde
>   van wat je wilt. De notitie zegt "nog volledig af te handelen qua
>   status/inspection_notice": **openstaand.**
> - **Regel 8 en 9 spreken elkaar tegen.** Tree Runner "EN1358 15 mm Steel Core
>   Lanyard" zou hernoemd worden naar 12.5mm, waarna regel 9 dat terugdraait:
>   het 15mm-product bestaat wél (grube.eu 71-043-20) en de 12.5mm Ergo Grip is
>   een apart, derde product. Regel 9 wint, dus het 15mm-item blijft ongemoeid.
>   De Ergo Grip zit **nog niet** in de bronlijst — aanleveren.
> - **Safe Vision opgelost via de Liros-lijst (besluit Jos 2026-07-31).** De
>   Liros-lijst bleek `Safe Vision, 11,8mm` te bevatten, volledig ingevuld
>   (EN 1891, 45 kN, 10/15 jaar, code `01596-0000`, serienummer op een label
>   onder de plastic huls). **Tree Runner is het huismerk van Grube voor
>   dezelfde touw** — bevestigd door Jos: "dat is dezelfde lijn". De bijna lege
>   Tree Runner-regel is daarom aangevuld met de fabrikantgegevens van Liros;
>   herkomst staat in `notes`. De eigen norm (`EN 1891 A`, specifieker dan die
>   van Liros), de diameter en de grube-productlink bleven staan.
> - **Safe Vision 12.8 mm verwijderd.** Liros levert die lijn alleen in 11,8mm,
>   dus de 12.8 was een fout in de oude lijst — precies wat de notitie zei. Mijn
>   tussentijdse advies om hem te bewaren (op grond van een eigen
>   grube-artikelnummer) is daarmee achterhaald.
> - **Ergo Grip 12.5mm: vervalt.** Stond alleen op de "nog toevoegen"-lijst,
>   nooit in de catalogus. Jos: niet toevoegen. Er viel dus niets te
>   verwijderen.
> - **`Tree Runner Safe Vision Static Line` verwijderd** (besluit Jos
>   2026-07-31). Had norm noch diameter, en welke Liros-lijn erachter zat was
>   niet vast te stellen. Daarmee staan er zes producten op de werklijst om
>   handmatig in de app weg te halen.
> - **Quick Cinch-specs binnen (2026-07-31, schermafdruk notchequipment.com):**
>   17mm = `NQCCL-17mm`, SWL 15 kg; 25mm = `NQCCL-25mm`, SWL 25 kg. De 15-25 kg
>   stond in `breaking_strength`, maar SWL is een werklast — verplaatst naar
>   `working_load_limit`. `breaking_strength` bewust leeggelaten: de fabrikant
>   geeft alleen een SWL bij verhouding 7:1 en drukt geen breuksterkte af.
>   Uitrekenen (7 × SWL) levert een getal op dat nergens op het product staat;
>   **Jos wilde het er toch in** (2026-07-31), dus ingevuld als
>   `105 kg (berekend: 7 x SWL)` en `175 kg (berekend: 7 x SWL)` — de herkomst
>   staat in de waarde zelf, zodat een keurmeester het niet aanziet voor een
>   afgedrukte fabrikantswaarde. Maten, lengtes en gewicht staan in `notes`.
> - **`--overwrite` kan de `id` niet meer wissen.** Bij deze correctie bleek dat
>   een aangeleverd bestand zonder id-kolom met `--overwrite` de bestaande id zou
>   leegschrijven — daarmee is een product zijn koppeling met de database kwijt
>   en zou het bij de volgende import gedupliceerd worden. `mergeRows` slaat de
>   `id`-kolom nu altijd over bij een lege waarde, ook met `--overwrite`.
> - **Besloten door Jos, doorgevoerd:** Courant Hulk → `rigging` /
>   "Lowering Bollards"; Tree Runner Abseil Figure-of-eight → `no_ppe`
>   ("hulpmiddel, geen ppe"); Notch Quick Cinch gesplitst in 17mm en 25mm.
>   Bij die splitsing is de **bestaande rij hernoemd naar 17mm** in plaats van
>   verwijderd-en-opnieuw-aangemaakt, zodat de `id` blijft en gekoppelde
>   klantartikelen niet losraken. Gevolg: een artikel dat eerder aan de
>   ongesplitste rij hing, hangt nu aan de 17mm-variant — **nakijken of dat
>   voor bestaande koppelingen klopt.** De breuksterkte staat op beide rijen nog
>   als "15-25 kg SWL (per width)"; per variant uitsplitsen is nog te doen.
> - **⚠ De importwizard overschrijft bij een update álle kolommen.** Bij een rij
>   mét `id` bouwt `buildPreview()` een volledige `ProductFormModel` op uit het
>   bestand (ontbrekende kolommen worden leeg) en schrijft die met `update` weg.
>   De "lege cel wist niets"-regel geldt dus alleen in de repo, niet in de app:
>   een besluit- of deelbestand naar de wizard sturen maakt de rest van het
>   product leeg. Altijd exporteren met `catalog:export` (leest uit de bronlijst,
>   levert alle kolommen). Nieuw: `--ids=` voor een paar gewijzigde producten
>   van verschillende merken.
> - **Verwijderen uit de bronlijst verwijdert niets in Gearonimo.** De import
>   voegt toe en werkt bij, meer niet. Die 4 producten moeten in de app zelf weg
>   via Catalogus → bewerken → Product verwijderen (`delete_product`, migratie
>   20260751, die ontkoppelt de artikelen netjes). Staat als waarschuwing in
>   `verwijder.mts` en in `catalog/README.md`.
>
> - **`--sinds=` voor één importbestand (2026-07-31).** Vraag Jos: *"kun jij
>   alle regels in Gear zetten zodat ik geen fouten met importeren kan maken?"*
>   Rechtstreeks wegschrijven kan nog steeds niet (netwerkpolicy + alleen-lezen
>   sleutel), maar het risico zat in de vier losse bestanden. `catalog:export
>   --sinds=<export.xlsx>` vergelijkt de bronlijst met een eerdere export uít de
>   app en levert alles wat daar nog niet in zit in één bestand: 296
>   toevoegingen + 25 bijwerkingen. Alleen echt gewijzigde regels, dus geen 94
>   Tractel-rijen waarvan er 84 ongemoeid zijn. Nagelopen met een nabootsing van
>   `buildPreview()`: 296 toevoegen, 25 bijwerken, 0 duplicaten, 0 fouten.
>   Verwijderen blijft handwerk in de app — dat kan de import niet.
> - **Bronlijst gevuld, geen migratie nodig.** `catalog/producten.csv` staat op
>   2365 producten en nul fouten: de live export uit Gearonimo (2308, mét id's)
>   als basis, plus 57 nieuwe Liros/Husqvarna-producten. Nog te importeren door
>   Jos: `-nieuw.xlsx` (57 toevoegingen) en `-tractel.xlsx` (94 bijwerkingen).

## Voortgang (bijgewerkt 2026-07-29)

> **Opmerkingenveld altijd in beeld op de artikelpagina (wens Jos
> 2026-07-29).** `notes` stond wél in `fieldDefs`, maar de bekijk-weergave
> toont een veld alleen als het gevuld is — precies wanneer je het veld zoekt
> (om iets te noteren) was het dus onzichtbaar, en dan moest je via het
> potlood naar het bewerkformulier. Nu een eigen blok onder de gegevens:
> altijd zichtbaar, meteen typbaar, met Opslaan/Annuleren zodra er iets
> verandert. `notes` is uit `viewFieldDefs` gehaald zodat het niet dubbel
> staat.

> **Product verwijderen vanuit de app (wens Jos: "ik wil zonder sql kunnen
> werken in de toekomst").** In `20260715` was verwijderen bewust geblokkeerd
> omdat de FK naar `articles` het zou tegenhouden. Besluit Jos 2026-07-29: de
> gekoppelde artikelen moeten gewoon blijven staan als vrij artikel — geen
> aparte stap vooraf, wél een waarschuwing met het aantal ("dit product wordt
> al 7 keer gebruikt").
> - **Migratie `20260751_delete_product.sql`**: `product_usage_count(uuid)` en
>   `delete_product(uuid)`, allebei `security definer` + curator-check. Bewust
>   een functie i.p.v. een delete-policy: het ontkoppelen raakt artikelen van
>   álle keurbedrijven (die mag de curator via RLS niet rechtstreeks
>   bijwerken) en zo blijft het één transactie. Merk/naam/categorie gaan terug
>   naar de vrije velden.
> - `CatalogManager.vue`: knop "Product verwijderen" in het bewerkformulier,
>   met een rode bevestigingsblok dat het aantal gebruiken noemt.

> **Sessie 2026-07-29 — catalogus-zoekveld vond "petzl seq" niet:** Het
> zoekveld op de Catalogus-tab eiste dat de héle zoekterm in één veld paste
> (`[brand, name, category].some(v => v.includes(q))`), dus een combinatie van
> merk + naam gaf nul resultaten terwijl de producten er gewoon stonden.
> Vervangen door dezelfde gedeelde `fuzzySearch` als de "bedoelt u"-koppeling,
> over merk + naam + categorie + `manufacturer_code`. Zoeken op "petzl seq",
> "seq 1" of een artikelcode werkt nu allemaal.

## Voortgang (bijgewerkt 2026-07-28, deel 6)

> **Sessie 2026-07-28 (deel 6) — zoeken op de artikelcode van de fabrikant:**
> Jos zocht in "bedoelt u" op "242" (artikel heet "Fallsafe FS242-L-XL" op het
> oude certificaat) en kreeg niets: het catalogusproduct heet "FALL SAFE LITE
> HARNESS L/XL" en de code staat in `manufacturer_code`, waar niet op gezocht
> werd.
> - `ArticleDetail.vue`: zoekt nu op merk + naam + `manufacturer_code`
>   (`productSearchText`), en toont de code in de suggestieregel zodat je ziet
>   dát het de juiste variant is.
> - **Migratie `20260750_search_products_manufacturer_code.sql`**: dezelfde
>   blinde vlek zat in de gedeelde `search_products`-functie (klant-app
>   "artikel toevoegen" + SN-zoeken). Zelfde handtekening, dus `create or
>   replace`; een exacte code-treffer sorteert bovenaan.

## Voortgang (bijgewerkt 2026-07-28, deel 5)

> **Sessie 2026-07-28 (deel 5) — koppeling herzien + wachtrij vanaf de
> artikelpagina (wensen Jos tijdens de koppelronde):**
> - **Een gekoppeld artikel was niet meer te corrigeren.** De "bedoelt
>   u"-sectie verscheen alleen bij vrije artikelen, dus een misklik (Jos koos
>   "Oranje-grijs", bedoelde "Oranje carbon") was definitief — ook het
>   bewerk-formulier raakt het product niet. Nu toont een gekoppeld artikel
>   "Gekoppeld catalogusproduct" met **Ander product kiezen** (opent dezelfde
>   zoeker, voorgevuld met de huidige productnaam) en **Ontkoppelen**.
>   Ontkoppelen schrijft merk/naam terug naar de vrije velden, anders houd je
>   een artikel zonder omschrijving over.
> - **Wachtrij-knop op de artikelpagina.** "Toevoegen aan productendatabase"
>   staat nu ook ín de koppelsectie (opent het bestaande
>   `CatalogSuggestDialog`), zodat een product dat niet in de catalogus staat
>   direct aangemeld kan worden zonder terug naar het klantdetail. Alleen bij
>   vrije artikelen — de wachtrij toont uitsluitend artikelen zonder
>   `product_id` (zie `CatalogQueue.vue`).

## Voortgang (bijgewerkt 2026-07-28, deel 4)

> **Sessie 2026-07-28 (deel 4) — doorklikken door de artikellijst
> (wens Jos):** Na de import staan er honderden vrije artikelen klaar om
> gekoppeld te worden (Weijtmans: 278). Terug naar het klantdetail en daar de
> volgende opzoeken was de traagste stap. Op de artikelpagina staan nu:
> - **← Vorige / Volgende →** met positie ("4 / 278"), in dezelfde volgorde als
>   de artikellijst op het klantdetail (`created_at desc`, niet-afgevoerd).
> - **"Volgend vrij artikel (n te koppelen)"** — slaat alles over dat al aan de
>   catalogus hangt en loopt door tot het einde en dan vanaf het begin, zodat je
>   met één knop de hele lijst rond kunt.
> - Na het koppelen wordt het huidige artikel meteen als "niet meer vrij"
>   geteld, zonder de buurlijst opnieuw op te halen.
> - *Let op bij toekomstig werk:* `id` in `ArticleDetail.vue` is nu een `ref`
>   met een `watch` op `route.params.id`. Doorklikken houdt dezelfde route, dus
>   Vue hergebruikt het component — zonder die watch bleef de pagina op het
>   oude artikel staan.

## Voortgang (bijgewerkt 2026-07-28, deel 3)

> **Sessie 2026-07-28 (deel 3) — bronlijst nagelopen + "onbeperkte levensduur"
> als 999:** De 26 overgeslagen regels bleken géén echte duplicaten maar
> varianten die alleen in `manufacturer_code` verschilden. Bronlijst
> gecorrigeerd (2291 rijen, 0 dubbelen) en aan Jos teruggegeven:
> - **FALL SAFE** (11 producten × 3): maat uit de code achter de naam gezet
>   (`LITE HARNESS S/M` · `L/XL` · `XXL`). **CAMP** (2 × 2): `S-L` / `L-XXL`
>   (maatvoering bevestigd door Jos uit de CAMP-documentatie).
> - **Petzl OK SCREW-/TRIACT-LOCK**: de tweede regel (`M033D`, 23 kN,
>   "EN 12275 H") was foute scrape-data — M033D bestaat niet en H is de
>   HMS-klasse, terwijl de OK een ovaal is. Verwijderd; `M33A` (25 kN) blijft.
> - **Petzl-blok rij 1241-1334 (94 regels, NL-site) nagelopen:** CROLL S en
>   CROLL L hadden allebei dezelfde samengevoegde code (gesplitst naar
>   `B16BAA` / `B016AA00`); een generieke `ASCENSION` dupliceerde de al
>   bestaande Left/Right (verwijderd, handleiding-link overgezet); TANDEM,
>   TANDEM SPEED en KOOTENAY hadden geen belastinggegevens (aangevuld uit de
>   Petzl-specs die Jos aanleverde). Verder schoon.
> - **Besluit Jos: `UNL` wordt `999`, niet leeg.** Leeg leest als "nog
>   opzoeken", 999 als "bewust geen leeftijdsgrens". 1219 cellen omgezet.
>   In de code: `UNLIMITED_AGE_YEARS` + `isUnlimitedAge()` (≥ 900) in
>   `packages/core/nextDue.ts`; zowel `calcNextDue` als de
>   levensduur-waarschuwing in de keuring-wizard slaan de afkeurdatum dan over
>   (anders zou er een waarschuwing voor het jaar 3025 uitrollen). Hint bij het
>   productformulier: "999 = onbeperkte levensduur. Leeg = nog niet opgezocht."

## Voortgang (bijgewerkt 2026-07-28, deel 2)

> **Sessie 2026-07-28 (deel 2) — catalogus stond dubbel, import kan het niet
> meer:** Na de fix hierboven bleek de export ~5699 producten te bevatten in
> plaats van ~2294, vrijwel alles in dubbele paren: de bronlijst-import is meer
> dan één keer uitgevoerd en de import had géén dubbelcheck (rijen zonder `id`
> werden altijd als nieuw ingevoegd).
> - **Besluit Jos:** niet per stuk opruimen maar catalogus leeg + opnieuw
>   importeren. "Er gaat geen echte data verloren, die staat elders ook."
> - **Migratie `20260749_catalog_reset_and_unique.sql`** (idempotent, door Jos
>   te draaien): (1) artikelen ontkoppelen — mét terugschrijven van merk/naam/
>   categorie naar de vrije velden, want `articles.product_id` heeft een FK
>   zonder ON DELETE én bij koppelen worden de vrije velden geleegd, dus anders
>   blijft er een naamloos artikel over; (2) `delete from products`; (3) unieke
>   index op `lower(btrim(brand)), lower(btrim(name))` — die wordt alleen
>   aangemaakt als er écht geen dubbelen meer zijn, anders een `notice` i.p.v.
>   een harde fout.
> - **Import doet de dubbelcheck nu zelf** (`CatalogManager.vue`): tegen de
>   bestaande catalogus én binnen het bestand, op merk + naam zonder hoofdletter-
>   /spatieverschillen — dezelfde regel als de unieke index. Preview meldt
>   "{n} stond er al (overgeslagen)". Opnieuw dezelfde lijst uploaden voegt dus
>   niets meer toe.
> - **Insert in blokken van 500** i.p.v. één reuzen-insert: één foute waarde
>   sloopt niet langer de hele batch (vgl. de 190,5 kg-crash), en de import is
>   herhaalbaar — wat al binnen is, wordt overgeslagen. Voortgang in beeld.
> - i18n nl+en: `duplicateSkipped`, `andMore`, `importProgress`,
>   `previewSummary` uitgebreid.

## Voortgang (bijgewerkt 2026-07-28)

> **Sessie 2026-07-28 — "bedoelt u"-zoekveld vond de halve catalogus niet:**
> Melding Jos (desktop): typen van "Dis" bij *Bedoelt u* gaf "Geen passend
> product in de catalogus gevonden", terwijl het catalogusoverzicht met
> dezelfde zoekterm gewoon vier Distel-producten liet zien.
> - **Oorzaak: Supabase kapt elk antwoord stil af op "Max rows" (1000).** Sinds
>   de bronlijst-import telt de catalogus 2294 producten. De artikelpagina haalde
>   ze zónder sortering of paginering op en kreeg dus een willekeurige 1000 rijen
>   — zonder foutmelding. Het catalogusoverzicht sorteerde op merk, dus de D's
>   zaten daar toevallig nog binnen de grens; vandaar het verschil.
> - **Gedeelde `fetchAllRows` in `packages/core`** (`fetchAll.ts`): herhaalt een
>   query met `.range()` tot de tabel op is, en gooit een fout dóór in plaats van
>   hem te slikken. Nu gebruikt door de artikelpagina, `CatalogManager`,
>   `CustomerArticles` en `SerialSearch` — alle vier zaten stil op 1000.
>   **Dit repareerde ook "Exporteren naar Excel"**, dat een onvolledige catalogus
>   wegschreef zonder dat te melden.
> - **`fuzzySearch` in `packages/ui`**: de suggesties vallen nu terug op steeds
>   minder zoekwoorden. Het veld is voorgevuld met de vrije schrijfwijze van het
>   oude certificaat, en "Distel Alu kort" matchte niets omdat "kort" in geen
>   enkele catalogusnaam staat → nu "Distel Alu" → Distel Alu 3.1 / Alu Plus.
> - Een mislukte catalogus-aanroep toont voortaan de foutmelding onder het veld,
>   in plaats van eruit te zien als "niets gevonden".
> - Geen migratie nodig.
> - *Nog open (niet aangeraakt):* de offline-download (`offline/download.ts`)
>   haalt artikelen/producten ook zonder paginering op — pas een probleem bij een
>   klant met >1000 artikelen.

## Voortgang (bijgewerkt 2026-07-27)

> **Sessie 2026-07-27 — geïmporteerde keuring + "bedoelt u"-dropdown (wensen Jos):**
> - **Geen valse certificaat-melding meer.** Een geïmporteerde keuring
>   (`inspections.source = 'import'`) heeft bewust géén certificaat-PDF (het
>   originele document is de bron). Bij het openen van zo'n afgeronde keuring
>   toonde de keuring-wizard tóch "✅ Certificaat gegenereerd en gearchiveerd".
>   Nu is er een aparte tak (`isImported`): "📄 Geïmporteerd uit een oud
>   certificaat. Er is geen nieuw certificaat aangemaakt — het originele
>   document blijft de bron." (`InspectionWizard.vue`, i18n `certificateImported`).
>   Sluit aan op de klantpagina die terecht "Certificaten (0)" toont.
> - **"Bedoelt u"-koppeling is nu een zoek-dropdown** (artikelpagina, vrij
>   artikel → catalogusproduct). De originele vrije omschrijving blijft als
>   vaste referentie in beeld ("Originele omschrijving"), zodat die leesbaar
>   blijft terwijl de keurmeester in het zoekveld het juiste product opzoekt.
>   De suggesties klappen onder het veld uit (mousedown.prevent + close-on-blur),
>   zelfde patroon als de klant-picker in de importwizard. (`ArticleDetail.vue`,
>   i18n `linkOriginal`.)
>   - *Shortcut/nette werk:* de dropdown is inline gebouwd volgens het bestaande
>     picker-patroon i.p.v. een gedeeld combobox-component. Een echt gedeelde
>     `GCombobox` zou de klant-picker (importwizard), SN-/merk-dropdowns
>     (keuring-wizard) én deze koppeling kunnen bundelen — losse vervolgstap.

## Voortgang (bijgewerkt 2026-07-22, deel 3)

> **Sessie 2026-07-22 (deel 3) — import ongedaan maken:** In stap 1 van de
> importwizard staat nu een lijst "Eerdere imports" (per keurbedrijf, nieuwste
> eerst) met een verwijderknop + inline bevestiging.
> - `listImportBatches()` / `deleteImportBatch()` in `useImportCommit.ts`.
> - Verwijderen haalt de keuringen van de batch weg (inspection_items →
>   inspections via `import_batch_id`), het originele bestand uit Storage en de
>   batchrij. **Artikelen en klanten blijven bewust staan** — ze zijn niet aan
>   de batch gekoppeld (`articles` heeft geen `import_batch_id`) en kunnen
>   inmiddels bewerkt/gekoppeld zijn; de dedup (klantnaam + serienummer)
>   hergebruikt ze bij opnieuw importeren.
> - Bedoeld pad voor de Weijtmans-import: batch verwijderen → opnieuw
>   importeren, nu met de *-fix (telt als goed) én de standaard 12-mnd-datum.
> - Let op-randje: artikelen zónder serienummer worden bij opnieuw importeren
>   niet herkend door de dedup en kunnen dan dubbel ontstaan (bestaande
>   dedup-beperking, niet nieuw).

## Voortgang (bijgewerkt 2026-07-22, deel 2)

> **Sessie 2026-07-22 (deel 2) — artikelpagina verrijken na de import:** Na de
> eerste import staan alle artikelen als "vrij artikel" (schrijfwijze op het
> oude certificaat matcht niet exact een catalogusnaam). Jos wil ze vanaf de
> artikelpagina kunnen koppelen. Gebouwd:
> - **"Bedoelt u"-productkoppeling op de artikelpagina.** Een vrij artikel
>   toont een fuzzy-gesorteerde suggestielijst (hergebruik `fuzzyScore` uit
>   `packages/ui`) van catalogusproducten; één klik koppelt het artikel
>   (`product_id` gezet, vrije velden geleegd), waarna keurtermijn/recall/
>   handleiding vanzelf van het product komen. Zoekterm is voorgevuld met de
>   vrije schrijfwijze.
> - **Keurtermijn (maanden) als bewerkbaar veld** op het artikel
>   (`interval_override_months`, bestond al als kolom sinds `20260623`). Zo is
>   de volgende-keuringstermijn per artikel bij te stellen.
> - **Import zet voortaan een standaard volgende-keuringsdatum.** Afgeronde
>   geïmporteerde keuringen zonder eigen "volgende keuring"-kolom krijgen
>   `keurdatum + 12 mnd` (GB 6 mnd, o.b.v. `inspection_companies.country_code`).
>   Bewust aan de strenge kant (besluit Jos). Géén backfill van de al
>   geïmporteerde 278 artikelen — alleen nieuwe imports (keuze Jos).
> - `addMonths` geëxporteerd uit `packages/core` zodat de import dezelfde
>   maandeinde-veilige rekenwijze gebruikt als de keur-wizard.
> - Geen nieuwe migratie nodig.

## Voortgang (bijgewerkt 2026-07-22)

> **Sessie 2026-07-22 — eerste import bij echte klant:** Jos deed de eerste
> import met een echt klantbestand (~270 rijen). Twee dingen bijgesteld:
> - **`*` als "goedgekeurd" herkend.** Het bestand markeerde goedgekeurde
>   artikelen met een sterretje in de "Goed"-kolom; `normalizeResult`
>   (`useImportCommit.ts`) kende `x`/`✓`/`v` wél maar `*` niet, waardoor de
>   uitslag op *nog te doen* bleef staan (scherm: "0 goed · 20 afgekeurd ·
>   250 nog te doen"). Nu tellen één of meer sterretjes (`*`, `**`) als
>   goedgekeurd; ook `✔`/`☑` toegevoegd naast het bestaande `✓`.
> - **Voortgang tijdens de import.** Stap 5 toonde één statische regel
>   "Bezig met importeren…" en leek daardoor bevroren bij honderden rijen
>   (elke rij = meerdere DB-calls). `commitImport` geeft nu voortgang terug
>   via een `onProgress`-callback; de wizard toont "Bestand uploaden…" en
>   daarna "Rij x van y…" met een balk.
> - **Nog open:** de al geïmporteerde keuring staat nog met de oude uitslagen
>   in de database — die 250 items zijn niet met terugwerkende kracht
>   bijgewerkt. Optie: die importbatch verwijderen en opnieuw importeren nu de
>   `*` wél telt (dedup op naam + serienummer vangt dubbele klanten/artikelen
>   af). Met Jos afstemmen.

## Voortgang (bijgewerkt 2026-07-21)

> **Sessie 2026-07-21 — keurmeester-onboarding & login:** Jos liep erop vast
> dat uitnodigingsmails voor keurmeesters niet aankwamen. Uitgezocht: het
> ligt niet aan de app of Zoho (Zoho's leveringslogboek toont alles als
> "Gelukt"). Gmail ontvangt wél, Microsoft 365 (safetygreen.nl) houdt de
> Supabase-"Confirm your email address"-mail stil tegen (quarantaine, geen
> bounce, niet in spam). Dat is filtering aan ontvangerskant; een custom
> auth-domein zou helpen maar zit niet in het gratis Supabase-plan.
> Daarom vier aanpassingen gebouwd:
> - **Redirect-bug gefixt:** een keurmeester-uitnodiging (CompaniesAdmin.vue
>   `inviteAndLink`) gaf geen `redirectTo` mee en landde daardoor via de Site
>   URL in de klant-app. Nu expliciet `window.location.origin + '/'` (keurder-
>   app, history-router op de root). **Actie Jos:** controleer dat die URL in
>   Supabase → Auth → URL Configuration → Redirect URLs staat (Site URL van de
>   keurder-app volstaat meestal al).
> - **Platform-admin kan een wachtwoord instellen** per keurmeester
>   (vangnet als de mail niet aankomt): knop "Wachtwoord instellen" in het
>   Bedrijven-scherm → nieuwe RPC `platform_admin_set_inspector_password`
>   (migratie **20260748**, nog door Jos uit te voeren). Die schrijft in
>   `auth.users` (bcrypt via pgcrypto) + bevestigt het e-mailadres. **Raakt de
>   auth-interne tabel** — na uitvoeren op één account testen (instellen →
>   uitloggen → inloggen met e-mail+wachtwoord).
> - **Zelf-service wachtwoord** in de keurder-app: nieuwe Instellingen-sectie
>   "Wachtwoord" (PasswordSettings.vue, voor elke ingelogde gebruiker) waarmee
>   een via magic-link binnengekomen keurmeester zelf een wachtwoord kiest
>   (`updatePassword`, geen mail nodig). De keurder-app hád al wachtwoord-
>   login; alleen kreeg een uitgenodigd account nog geen wachtwoord.
> - **Inlogschermen gelabeld:** duidelijk pil-label "Keurder-app · voor
>   keurmeesters" (groen) vs "Klantportaal · voor klanten" (blauw), zodat
>   meteen zichtbaar is in welke app je inlogt.
> Builds (inspector+customer) en tests groen. Migratie 20260748 nog uitvoeren.

## Voortgang (bijgewerkt 2026-07-19)

> **Sessie 2026-07-19 — platform-admin en bedrijvenbeheer (fase 4
> vooruitgetrokken):** Gat gedicht dat platform_admin nergens echte
> rechten had. Nieuwe Instellingen-tegel **Bedrijven** (alleen
> platform-admin): keurbedrijven aanmaken (naam, land uit een volledige
> uitgeschreven landenlijst via Intl.DisplayNames — NL/BE/DE/GB/CA
> bovenaan — plus e-mail/telefoon/adres/postcode/plaats/provincie/KvK/BTW),
> eerste beheerder koppelen op e-mailadres (bestaat er nog geen account,
> dan een **uitnodiging via magic-link**), curator-vinkje per keurmeester
> platform-breed, en **bedrijf verwijderen** (alleen zonder
> keuringen/import-historie; het laatste-beheerder-vangnet kreeg daarvoor
> een transactie-lokaal ontsnappingsluik). Daarnaast **platform-admin
> volledig losgekoppeld van keurmeester-zijn** (besluit Jos: platformbeheer
> en keuren gescheiden — info@gearonimo.net beheert, keuren gebeurt straks
> met een eigen jos@safetygreen-account): router laat een platform-admin
> zonder keurmeester-rij door naar /settings, het hoofdmenu toont dan een
> platformbeheerder-melding, is_catalog_curator() geldt ook voor
> platform-admins en de catalogus-wachtrij kreeg platform-admin-policies.
> Migraties 20260740 t/m 20260745, alle door Jos uitgevoerd. NB: de
> keurmeester-rij van info@gearonimo bij Safety Green blijft staan tot
> daar een andere beheerder is (vangnet); daarna op inactief zetten.
>
> **Fase 5 gestart (zelfde sessie, 2026-07-19):** het **VK-regime is
> actief** in de keuring-wizard — de voorgestelde volgende-keuringsdatum
> valt nu, ná artikel-/product-override en bedrijfsinstelling, terug op het
> wettelijke regime van het land van het keurbedrijf (GB = 6 mnd voor
> PBM/hijsmateriaal per LOLER/PUWER; NL = 12 mnd; onbekend = 12). Voor
> NL-bedrijven verandert er niets. En het **certificaat-PDF is tweetalig**:
> alle vaste teksten (titel, kolomkoppen, datums, voetblok,
> paginanummering) volgen het land van het keurbedrijf (NL/BE = nl, rest =
> en — zelfde regel als het language-metadataveld), inclusief de live
> preview. Bewust een eigen label-tabel in useCertificate.ts, niet i18n:
> de certificaattaal volgt het bedrijf, niet de UI-taal van de keurmeester.
> Geverifieerd met een render-script (beide talen gecontroleerd op alle
> teksten). Geen migratie nodig.
>
> **Besluiten Jos (2026-07-19, tweede ronde, raken fase 5):**
> - **Zelf-aanmelding blijft open** — geen invite-slot bouwen; wie zichzelf
>   aanmeldt is welkom (klantenbinding), gratis gebruikers in beide apps
>   tijdens de testfase.
> - **Capacitor/stores pas na ±6 maanden uitgebreide testfase** — eerst
>   zeker weten dat alles goed is.
> - **Kwalificaties keurmeesters:** NIET op het certificaat; wél
>   doorklikbaar naar de kwalificatie-PDF's van de keurmeester via de
>   QR/verify-pagina. Gebouwd (zelfde sessie, migratie 20260746): per
>   kwalificatie een expliciete "Zichtbaar bij verificatie"-schakelaar in
>   Instellingen → Keurmeesters — aanzetten kopieert het bewijs naar de
>   publieke branding-bucket, uitzetten haalt de kopie weg; de privé-bucket
>   blijft dicht en de verify-RPC toont alléén gedeelde kwalificaties
>   (naam/nummer/geldig-tot + link). Verify-pagina toont nu ook de
>   keurmeester-naam.
> - **Testplan:** Jos heeft ~4 dagen getest en liep tegen zaken aan die
>   later gebouwd zouden worden (veel inmiddels gefixt). Eerst de app "echt
>   klaar" maken, dan pas een nieuwe volledige testronde.
> - **Spiekbriefje** (uit klimkeurpro, gemist in gearonimo): dag/week-
>   omrekenaar + SN-referentie per merk — gebouwd in deze sessie, zie
>   hieronder.
>
> **Besluiten Jos (2026-07-19), raken fase 4:** geen DB-naar-DB-migratie
> van de oude klimkeurpro-data nodig — alles staat dubbel op de zaak (incl.
> PDF's), testklanten krijgen gewoon een uitnodigingscode en beginnen leeg
> (bij de eerstvolgende keuring is hun status weer actueel); wie historie
> wil kan per klant via de bestaande Excel/CSV-import. NAS-back-up wacht op
> het aansluiten van de NAS zelf (hardware, actie Jos). Certificaattaal-
> metadata gefixt (NL/BE = nl, rest = en); het PDF zelf is nog
> Nederlandstalig en het VK-regime (6 mnd) is nog niet actief in de wizard
> — beide expliciet fase 5.

## Voortgang (bijgewerkt 2026-07-18)

> **Sessie 2026-07-18 — grote code review + afronding openstaande punten:**
> Diepe review van beide apps, core en alle migraties: 16 punten gevonden,
> 14 gefixt en live (migraties 20260734 t/m 20260739, alle door Jos
> uitgevoerd). Hoogtepunten: stil dataverlies gedicht (keurresultaat-save,
> vastgelopen sync-mutaties), identiteit gewist bij uitloggen,
> datum-verschuivingen gefixt (Excel-import/next_due/offline), storage per
> keurbedrijf afgeschermd, **certificaatnummers uniek** via server-side
> volgnummer (JJJJMMDD-KLANT, -2, -3 ...), verify + PDF lezen uit de
> bevroren article_snapshot, "vorige keuring"-hint slaat not_assessed over
> en sorteert op keurdatum, maandeinde-randgeval in addMonths, rem op
> invite-codes (10/uur), nette melding bij klant-verwijderen met historie.
> Verder: **certificaatnummers zichtbaar + doorzoekbaar** op de
> keuringen-pagina, klantpagina-blokken inklapbaar met nieuw
> **Certificaten-blok** per klant, **rollen en rechten af** (inspectors.
> is_admin server-side afgedwongen: bedrijfsgegevens/certificaat-opmaak,
> afkeurcodes, keurmeesters beheren en klanten verwijderen alleen voor
> beheerders; vangnet-trigger tegen "laatste beheerder weg"; menu verbergt
> beheerder-secties), en **Zoho-SMTP live** (smtppro.zoho.eu:587,
> app-wachtwoord, afzender info@gearonimo.net — getest). Parallel is in een
> andere sessie passkey/vingerafdruk-login aan de klant-app toegevoegd.
> Nog open uit de review: alleen cosmetisch (env-bestand/.gitignore
> tegenstrijdig, migratienamen 20260732+ zijn geen echte datums).

## Voortgang (2026-07-02)

- **GitHub:** github.com/Gearonimo-app/gearonimo · **Supabase:**
  buitfeiclivzzldfdelp.supabase.co (EU).
- **Fase 1 (skelet):** monorepo (packages/core+ui, apps/inspector+customer),
  i18n nl/en, domeinlogica met tests (status/next_due/regimes),
  e-mail+wachtwoord-login werkend in de inspector-app. ✅ grotendeels af.
- **Fase 2 — in uitvoering:** hoofdmenu werkt; **Klanten-lijst + uitgebreid
  klantformulier af** (zie DATAMODEL `customers`); **klantdetailscherm**
  `/customers/:id` af (bekijken/bewerken/verwijderen); **artikelen per klant**
  met catalogus-zoeken (fuzzy `search_products` + merkfilter, toetsenbord-nav)
  en velden gebruiker/ingebruikname/set/opmerkingen (gebruiker+set voorlopig
  vrije tekst — zie DATAMODEL `articles`); **artikeldetailscherm**
  `/articles/:id` af (bekijken/bewerken/afvoeren, geen harde delete); **echte
  sets af** — samengestelde artikelen (bv. een fliplijn van lijn + lijnklem +
  karabiner) groeperen via `article_sets`/`article_set_members`, los van het
  tijdelijke vrije-tekstveld `set_label` op artikelen zelf. **Medewerkers af**
  — eerste slice van `customer_members` (naam, functie, telefoon, e-mail,
  actief/inactief) op de klantkaart, simpeler dan het einddoel uit DATAMODEL
  (nog geen eigen account/uitnodigingscode per medewerker — zie DATAMODEL
  §`customer_members`). **Keuring-wizard af** (het hart van fase 2, zie
  UX-FLOW §9.3-9.5): Start/Hervat-knop op de klantpagina, en de wizard zelf
  in 4 stappen (artikelen kiezen, per artikel goed-/afkeuren met
  vorige-keuring-context en recall/levensduur-vlaggen, overzicht met
  aanpasbare volgende-keuringsdatum, afronden). Hiervoor is meteen de echte
  multi-tenant basis uit DATAMODEL aangelegd — `inspection_companies`,
  `inspectors` (automatisch aangemaakt per gebruiker, geen apart
  beheerscherm nodig), `customer_links` (automatisch gekoppeld, ook voor
  nieuwe klanten) — ook al is er vandaag nog maar één keurbedrijf; dit
  voorkomt dat dit straks alsnog moet worden rechtgetrokken.
  **Certificaat-PDF af (2026-06-24):** bij het afronden van een keuring
  (stap 4) wordt nu automatisch een PDF gegenereerd — kop/voettekst van het
  keurbedrijf (`inspection_companies.cert_header/footer`, nieuwe velden
  address/postal_code/city/email/phone), per artikel goed/afgekeurd met
  SN, afkeurcode/opmerking en "volgende keuring uiterlijk" + wettelijke
  basis (`packages/core` regimes), en een verificatie-QR. De PDF wordt
  **client-side** gebouwd (`pdf-lib` + `qrcode`, geen edge-function-infra
  nodig — dit verandert niets aan de juridische onveranderlijkheid) en
  éénmalig naar de publieke Storage-bucket `certificates` geüpload; een
  `certificates`-record (`number`, `storage_path`, `pdf_hash`, `verify_token`)
  wordt aangemaakt en `inspections.certificate_number` gezet. Scan van de
  QR (of het delen van de link) opent `/verify/:token`, een publieke pagina
  (geen account nodig) die via de nieuwe `verify_certificate`-RPC
  (security definer, beperkte velden) laat zien dat het certificaat echt is
  — zonder de volledige klant-/keuringdata aan anonieme bezoekers te geven.
  Certificaatnummer-formaat volgt Jos' huidige praktijk
  (`JJJJMMDD-KLANTNAAM`). Migratie: `supabase/migrations/20260624_certificates.sql`.
  **Plandocumenten teruggevonden en verplaatst (2026-06-26):** BLAUWDRUK,
  BOUWPLAN, DATAMODEL, UX-FLOW en ONDERZOEK-CERTIFICAATEISEN stonden op een
  branch van de **klimkeur-pro**-repo (verkeerde repo,
  `claude/klimkeurpro-english-translation-bco5ti`) en waren in geen
  sessie-scratchpad meer terug te vinden. Nu gekopieerd naar de root van de
  **gearonimo**-repo en gecommit naar `main`, zodat ze niet nogmaals
  kwijtraken.
  **Keuringstabel-redesign (2026-06-26):** de invoer/zoekvelden bovenaan de
  keuringswizard zijn vervangen door een eigen inline suggestielijst i.p.v.
  de native `<datalist>` (die altijd over de tabel heen viel). Elk veld
  zoekt nu in zijn eigen, afgebakende bron: Artikel/Merk/Categorie in de
  catalogus (Artikel optioneel genauwd door gekozen Merk/Categorie),
  Serienummer alleen in de artikelen die al op déze keuringslijst staan.
  Pijltjestoetsen (↑/↓) lopen door de suggesties, Enter kiest, Escape
  sluit, de lijst scrollt automatisch mee. Verder toegevoegd aan de
  keuringstabel: een **Gebruiker**-kolom (`assigned_user_name`, vooruitlopend
  op de echte `assigned_member_id`-koppeling uit DATAMODEL §3), een
  **handleiding-link** (catalogus: `products.manual_url`; vrij artikel:
  `articles.free_manual_url`, met een knop om die toe te voegen), en een
  **recall-waarschuwing** (catalogus: automatisch uit `products.recall_url`;
  vrij artikel: handmatige toggle via nieuwe kolommen
  `articles.free_recall_flag`/`free_recall_url`). Migratie:
  `supabase/migrations/20260625_free_recall_manual_url.sql` (uitgevoerd in
  Supabase).
  **Echte bedrijfsgegevens + afkeurcodes ingevuld (2026-06-25):** Jos heeft
  de echte naam/adres/kop-/voettekst van Safety Green B.V. en de 8
  afkeurcodes uit de huidige praktijk aangeleverd (1 slijtage/opgebruikt,
  2 mechanisch beschadigd, 3 brand- of smeltplekken, 4 roest, 5 leeftijd of
  label, 6 defecte sluiting, 7 modificatie, 8 anders/zie opmerkingen) — zie
  `supabase/migrations/20260625_company_details_and_rejection_codes.sql`,
  uitgevoerd in Supabase. Afkeurcodes zijn nog **niet** door de gebruiker
  zelf te beheren (geen instellingenscherm); dat staat nog open.
  **Gemerged naar `main` en live (2026-06-25):** de feature-branch is
  fast-forward gemerged naar `main` en gepusht; gearonimo.net (GitHub
  Pages, auto-deploy bij push naar `main`) draait nu met de
  certificaat-functionaliteit. **We staan op het punt van de eerste echte
  test**: Jos gaat een volledige keuring afronden op
  https://gearonimo.net en controleren of het certificaat klopt
  (PDF-inhoud, QR-link naar `/verify/:token`, downloadlink). Resultaat van
  die test nog niet teruggekoppeld — vervolgsessie begint hiermee.
  Bewust nog buiten scope: foto's bij afkeuring. (Het instellingenscherm voor
  afkeurcodes is inmiddels wél gebouwd — zie de Instellingen-tegel hieronder.)
  **SN-zoeken / Recall-tegel af (2026-06-26):** de dode link op het
  hoofdmenu (`/serial-search`) is nu een echte pagina
  (`apps/inspector/src/pages/SerialSearch.vue`) met **twee modi** (schakelaar
  bovenaan), gelijk aan de oude KlimKeur Pro-functie `js/snref.js`:
  - **Serienummer zoeken** — op (een deel van) het serienummer, Jos' primaire
    zoekgedrag op de laatste cijfers (UX-FLOW §4.2), aangevuld met
    merk/omschrijving/categorie (vrije artikelen) en de fuzzy
    `search_products`-cataloguszoeker; resultaten linken naar `/articles/:id`.
    Per treffer: klantnaam, SN en de recall-/keuringsmelding-vlaggen +
    handleiding-link (catalogus: `products.recall_url`/`inspection_notice_url`/
    `manual_url`; vrij artikel: `free_recall_flag`/`free_recall_url`/
    `free_manual_url`) — systeem signaleert, keurmeester beslist (UX-FLOW §1.6).
  - **Recall zoeken** — de terugroepactie-zoeker uit de oude app: vind álle
    artikelen in het klantenbestand die onder een recall vallen, op merk +
    product + fabricagedatum-bereik (vóór jaar/maand én vanaf jaar/maand —
    symmetrisch, dus een echt van–tot-bereik), bv. "Petzl Astro vóór oktober
    2023". Product-match is bevat-match over naam + categorie, zodat "astro"
    ook Astro Int / Astro Bod Fast / Astro mt 2 vindt. Resultatentabel
    (product, merk, SN, fabricage, gebruiker, klant) met **CSV-export** en
    doorklik naar `/articles/:id`. Alle bouwjaar/maand-filtering gebeurt
    client-side (niet server-side) — anders zou Postgres' `lte/gte` de
    artikelen zónder bouwjaar al wegfilteren. Die mogen we bij een recall niet
    stil weglaten: ze worden **getoond en gemarkeerd** ("bouwjaar onbekend —
    zelf controleren", bovenaan gesorteerd, met telling), zodat de keurmeester
    beslist (UX-FLOW §1.6). Merk/product-match is sowieso client-side (merk/naam
    komt zowel uit `products` als uit `free_*`, niet in één query te filteren).
  Geen migratie nodig (alleen leesquery's op bestaande kolommen). De zoekbalk
  bovenaan het hoofdmenu wees naar een niet-bestaande `/search` en stuurt nu
  door naar deze pagina (serienummer-modus). Nog geen multi-tenant scope op
  actieve `customer_links` — bewust gelijk aan de rest van de app zolang RLS
  uit staat en er één keurbedrijf is. Bewust niet (nog) overgenomen uit de
  oude app: de keuringstatus-kolom in de recall-tabel (status is in Gearonimo
  berekend i.p.v. opgeslagen) en de klikbare sorteerkoppen.
  **Live getest en akkoord (2026-06-26):** Jos heeft beide modi op
  gearonimo.net getest — serienummer-zoeken werkt, en recall-zoeken werkt
  zowel mét fabricagedatum-bereik (artikelen in/buiten bereik) als zonder
  (artikelen zonder bouwjaar netjes getoond + gemarkeerd). Tegel is af; de
  feature-branch is naar `main` gemerged (live).
  Nog te bouwen: UI-opmaak/styling-pas, plus de **Instellingen-tegel** (de
  laatste grote tegel — zie UX-FLOW §7.5/§9.1) en kleinere afwerking
  (keuringen-overzicht is een eerste opzet).
  **Instellingen-tegel gestart — onderdeel 1: afkeurcodes-beheer
  (2026-06-25):** de laatste dode link op het hoofdmenu (`/settings`) is nu
  een echte pagina (`apps/inspector/src/pages/Settings.vue`), opgezet als hub
  met meerdere onderdelen (UX-FLOW §7.5/§9.1). Eerste onderdeel af:
  **Afkeurcodes beheren** (`components/RejectionCodes.vue`) — toevoegen,
  wijzigen en aan-/uitzetten (inline toggle) van de codes uit
  `rejection_codes`; voedt rechtstreeks de afkeur-keuze in de keuring-wizard
  (`fetchRejectionCodes` in `useInspections.ts`).
  **Afkeurcodes zijn per keurbedrijf instelbaar (besluit Jos 2026-06-25):**
  elk keurbedrijf beheert zijn eigen, losse set (`company_id` = bedrijf);
  wijzigingen van het ene bedrijf raken een ander bedrijf nooit. De 8
  platformstandaard-codes (`company_id` leeg) blijven alleen als
  sjabloon/fallback: een bedrijf zonder eigen codes valt daarop terug, en bij
  de eerste opening van het instellingenscherm wordt automatisch een eigen
  kopie geseed. Bestaande keurbedrijven worden door de migratie
  `supabase/migrations/20260627_rejection_codes_per_company.sql` (idempotent)
  van een eigen kopie voorzien. In de UI is er daardoor geen platform/eigen-
  onderscheid meer: alle getoonde codes zijn van het bedrijf zelf, vrij te
  bewerken/verwijderen. (Dit corrigeert de eerste opzet, waarin de gedeelde
  platformcodes ter plekke werden bewerkt — fout, want dat zou alle bedrijven
  tegelijk raken.) De twee overige onderdelen (certificaat-kop/voettekst,
  keurmeesters + kwalificaties) staan als "Binnenkort" in de hub en zijn de
  volgende deelstappen. **Let op voor onderdeel 2 (Jos 2026-06-25):** de
  certificaat-kop/voettekst-standaard wordt óók **per keurbedrijf** instelbaar,
  *niet* "per land/regime" zoals UX-FLOW §7.5 nu nog schrijft — dat punt is
  hiermee overruled. i18n nl+en toegevoegd onder `settings`.
  **Instellingen onderdeel 2: certificaat-template + opmaak-wizard
  (2026-06-25):** de certificaat-PDF is herbouwd tot een echte layout-engine
  (`useCertificate.ts`), met een opmaak-wizard onder Instellingen →
  Certificaat-template (`components/CertificateSettings.vue`). Per keurbedrijf
  instelbaar (besluit Jos: per keurbedrijf, niet per land): bedrijfsgegevens
  (naam/adres/contact), kop-/voettekst (met knop "standaardtekst invoegen" —
  één generieke juridische tekst, géén per-land-bibliotheek), **logo-upload**
  (Storage-bucket `branding`) met **grootte-slider, uitlijning en
  links/rechts-nudge**, plaats van de bedrijfsgegevens, accentkleur, en
  **afdrukstand** (staand/liggend/automatisch). Alles met **live PDF-preview**
  die meebeweegt (client-side gerenderd met dezelfde generator + fictieve
  voorbeelddata). De generator zelf: echte tabel met automatisch passende
  kolombreedtes + tekstafbreking, automatische oriëntatie (liggend zodra de
  tabel te breed wordt), herhaalde kolomkop per pagina, **handtekening/QR/
  voetblok dat bij elkaar onderaan blijft** (lost de "wees-handtekening op
  pagina 2" op), en paginanummers ("Pagina X van N"). De opmaak is een sjabloon
  voor **nieuwe** certificaten; al uitgegeven PDF's blijven onveranderd. Nieuwe
  velden `inspection_companies.logo_path` + `cert_layout` (jsonb) en de
  publieke `branding`-bucket: migratie
  `supabase/migrations/20260628_certificate_branding.sql`. Headless getest
  (staand/liggend/meerdere pagina's gerenderd en visueel gecontroleerd);
  live-test door Jos volgt. i18n nl+en onder `settings.certificate`.
  **Instellingen onderdeel 3: keurmeesters + kwalificaties (2026-06-26):** de
  laatste "Binnenkort" in de hub is af — Instellingen → Keurmeesters
  (`components/InspectorsSettings.vue`). Lijst van keurmeesters van het bedrijf
  (badges admin/geen-account/inactief), toevoegen/bewerken (naam, beheerder,
  actief), en per keurmeester een **kwalificatielijst** (naam, nummer, geldig-
  tot met verlopen/verloopt-binnenkort-markering) met **upload én bekijken van
  kwalificatiebewijzen** (PDF/foto). Schemawijziging
  `20260629_inspector_qualifications.sql`: `inspectors.user_id` nullable
  gemaakt (een admin kan een keurmeester + certificaten vastleggen vóór die
  zelf inlogt; account-koppeling later), `is_admin` toegevoegd, de
  `inspector_qualifications`-tabel aangelegd, en een **private** Storage-bucket
  `qualifications` (gevoelige documenten — niet publiek zoals logo/certificaat;
  toegang via signed URLs). Harde delete van een keurmeester alleen voor
  account-loze records; anders op inactief. Hiermee zijn alle drie de
  onderdelen van de Instellingen-tegel af. Bewust nog buiten scope:
  account-invite/koppeling voor keurmeesters, en kwalificaties tonen aan
  klanten / op het certificaat. i18n nl+en onder `settings.inspectors`.
  **Certificaat-kop verfijnd + extra velden (2026-06-26, na live-test Jos):**
  bedrijfs- én certificaatgegevens staan nu als twee kolommen bovenaan en
  flankeren een gecentreerd logo (i.p.v. eronder). Extra sliders: logo
  verticaal (`logoOffsetY`) en gegevens verticaal (`headerOffsetY`). Nieuwe
  optionele bedrijfsvelden `province`/`registration_number`/`vat_number`
  (migratie `20260630_company_address_extra.sql`), alleen getoond als ingevuld
  (provincie bv. voor Canada). Gearonimo-merk op het certificaat: een groen
  "g"-monogram in het midden van de verificatie-QR (QR nu op error-correctie
  `H` zodat dat de scanbaarheid niet breekt) + "geverifieerd met gearonimo".
  Een echt Gearonimo-logo-bestand kan later het monogram vervangen.
  **Echt Gearonimo-logo + branded QR (2026-06-26):** Jos leverde het
  Gearonimo-merk (karabijnhaak die een G vormt met een vinkje); het zit nu in
  het midden van de verificatie-QR (branded QR, error-correctie H, scanbaarheid
  geverifieerd met een echte decoder). QR-grootte gelijkgetrokken met de groene
  "geverifieerd"-regel eronder, en bij bedrijf-links wordt het certificaatblok
  netjes rechts uitgelijnd. Logo inline als base64 (`composables/gearonimoMark.ts`).
  **Certificaat: configureerbare kolommen (2026-06-26):** de tabel is opgebouwd
  uit losse kolommen; vast = Status/Merk/Artikel/Bouwjaar/Serienummer, optioneel
  (aan/uit in de wizard) = Categorie/Norm/MBS/Gebruiker/Volgende keuring/
  Afkeurcode-opmerking (zo kan "norm i.p.v. categorie" of "MBS erbij"). Een kolom
  verschijnt alleen als hij aan staat én er data voor is. `cert_layout.columns`
  (jsonb, geen migratie). Norm = `products.standard`, MBS =
  `products.breaking_strength`.
  **Keuring-flow-polish na live-test (2026-06-26):** recall-vlag bij vrij
  artikel niet langer dubbel (alleen-lezen vlag enkel voor catalogus, vrije
  artikelen alleen de toggle); **Tab = Enter** bij materiaal-invoer (bevestig
  suggestie + naar volgend veld); **wachtlijst-vinkje "naar catalogus"** nu ook
  in de keuring-wizard bij een vrij artikel; **home-knop (🏠)** in de kopbalk
  van keuring-wizard, klant-, artikel- en setdetail.
  **Norm/MBS bij vrije artikelen (2026-06-26):** als een keurbedrijf de Norm-/
  MBS-kolom heeft aangezet, verschijnen die invoervelden nu ook bij vrije
  invoer (keuring-wizard + klantartikelformulier); opgeslagen in
  `articles.free_norm`/`free_mbs` (migratie `20260701_articles_free_norm_mbs.sql`),
  certificaat valt voor vrije artikelen op die velden terug. Zichtbaarheid via
  `fetchFreeInputFields` (leest `cert_layout.columns`).

  ### Volgende grote stap — Excel/CSV-import (onboarding-motor) {#next-excel-import}
  **Besloten met Jos 2026-06-26.** De catalogus bevat al veel echte producten;
  wat nog ontbreekt (en wat KlimKeur Pro wél had) is **import van bestaande
  Excel-certificaten/keuringen** zodat een keurbedrijf met historie kan
  overstappen zonder vanaf nul te beginnen. Dit is de algemene onboarding-tool
  voor **nieuwe keurbedrijven** (BLAUWDRUK §9), los van de directe
  DB-naar-DB-migratie van Safety Green's eigen oude Supabase (DATAMODEL §8).
  **Kernprobleem:** elk keurbedrijf heeft een andere kolomindeling/taal/
  datumnotatie. **Aanpak (de "truc"): een begeleide mapping-wizard in 3 lagen:**
  1. **Auto-herkenning** — lees de kopregel en match kolommen tegen
     Gearonimo-velden via een meertalig synoniemen-woordenboek + fuzzy matching
     (merk/brand/fabrikant→brand, serienr/SN/serial→serial_number,
     keurdatum/datum→inspection_date, goed-afgekeurd/OK-NOK→result, …).
  2. **Controle + live preview** — per kolom een dropdown (auto-gok
     voor-ingevuld), voorvertoning van de eerste ~10 rijen, en een
     droogloop-validatie (ontbrekende verplichte velden, onleesbare datums,
     dubbele serienummers) vóór commit.
  3. **Opgeslagen import-profiel per bedrijf** (`import_profiles`: company_id +
     mapping + bestandshandtekening) zodat een volgende import met dezelfde
     lay-out één klik is. Dít maakt "elk bedrijf andere kolommen" schaalbaar.

  **Ontwerpkeuzes voor de bouwsessie:**
  - **Granulariteit detecteren/vragen:** één bestand = één keuring (kop +
    artikelrijen) vs. platte lijst van meerdere keuringen.
  - **Historische certificaten = juridisch anker:** her-render een oude keuring
    NIET als nieuw PDF (bestond toen niet); bewaar het **originele bestand**
    (PDF/Excel) in Storage als bewijs en vul de **data** in het systeem,
    gemarkeerd `source='import'`/historisch (voor historie +
    volgende-keuringberekening).
  - **Dedup/idempotentie:** ontdubbelen op (klant + serienummer); keuze
    overslaan/bijwerken/toch toevoegen.
  - **Techniek:** client-side parsen met SheetJS (`xlsx`); `.xlsx` + `.csv`;
    gevoelige data pas na mapping naar de DB.
  - **Nieuwe tabellen (concept):** `import_profiles`, `import_batches`
    (originele bestand-ref + telling), markering `source` op
    articles/inspections.
  > Status: ontworpen, nog te bouwen. Begin een nieuwe chat hiermee (zie de
  > prompt die Jos bewaart). Catalogus-import van Safety Green-producten is
  > minder urgent geworden (catalogus al goed gevuld).

  **Aanpassing met Jos (2026-06-26): geen fuzzy matching.** Jos' bezwaar:
  elk keurbedrijf doet dit maar één keer, en kolomkoppen beginnen niet altijd
  bovenaan (bij Safety Green bv. pas rij 14; een andere keurmeester gebruikt
  een tabel in Word/Excel met eigen lay-out). Een synoniemenwoordenboek +
  fuzzy-matchlogica is dan overbodige complexiteit. **Nieuwe aanpak: de
  gebruiker wijst zelf de koprij en kolommen aan.** Laag 1 (auto-herkenning)
  is hierdoor vervallen; laag 2 is uitgebreid met een koprij-picker:
  1. **Koprij aanwijzen** — de gebruiker klikt in een rauwe voorvertoning
     (eerste ~25 rijen) op de rij met de kolomkoppen; lost het "rij 14"-
     probleem op zonder enige detectie. Startwaarde: de rij met de meeste
     niet-lege cellen in de eerste 30 rijen (`guessHeaderRow`), puur een
     snelkoppeling, niet bindend.
  2. **Kolommen koppelen** — per kolom een dropdown met Gearonimo-velden,
     voor-ingevuld via een lichte substring-hint (`guessMapping`, géén
     fuzzy/typo-matching) als die kolomkop een duidelijke aanwijzing geeft
     (bv. "serienr" → serienummer); de gebruiker corrigeert altijd zelf.
     Live voorvertoning van de eerste 3 waarden per kolom tijdens het kiezen.
  3. **Droogloop-validatie + preview** — vóór commit: ontbrekende verplichte
     velden, lege verplichte cellen per rij, dubbele serienummers binnen het
     bestand, onleesbare datums; voorvertoning van de eerste 10 gemapte rijen.
  4. **Opgeslagen import-profiel per bedrijf** blijft het einddoel (nog te
     bouwen) zodat een volgende import met dezelfde lay-out één klik is.

  **Geïmplementeerd (2026-06-26), volledige eerste versie incl. commit:**
  nieuwe Instellingen-tegel "Excel/CSV-import"
  (`apps/inspector/src/components/ImportWizard.vue`, `useImportMapping.ts`,
  `useImportCommit.ts`) in 5 stappen: (1) bestand kiezen (`.xlsx`/`.xls`/`.csv`
  via SheetJS/`xlsx`, client-side, tabblad-keuze bij meerdere sheets) — herkent
  hier al een eerder opgeslagen profiel op kolomkop-handtekening en vult
  koprij+mapping automatisch in; (2) koprij aanklikken in de rauwe
  voorvertoning; (3) per kolom een dropdown (Klant/Artikel/Keuring-groepen)
  met substring-hint-prefill + voorbeeldwaarden; (4) droogloop-validatie +
  preview van de eerste 10 rijen, met keuzes "dubbel serienummer overslaan"
  en "dit profiel onthouden"; (5) **importeren** — schrijft per rij een
  klant (find-or-create op naam, case-insensitive), artikel (dedup op
  klant+serienummer, `source='import'`) en keuring (rijen met dezelfde
  klant+datum komen in dezelfde `inspections`-rij, zoals een echte keurdag;
  status meteen `completed`, `source='import'`) plus `inspection_items`.
  **Geen nieuw certificaat-PDF** voor historische keuringen — in plaats
  daarvan gaat het originele bestand ongewijzigd naar de nieuwe private
  Storage-bucket `imports` als juridisch anker, gekoppeld via een
  `import_batches`-rij (`inspections.import_batch_id`). Bij "dit profiel
  onthouden" wordt de koprij+mapping opgeslagen in `import_profiles`
  (uniek per bedrijf + kolomkop-handtekening, upsert) zodat een volgende
  import met dezelfde lay-out automatisch wordt herkend. Nieuwe migratie:
  `supabase/migrations/20260702_import_tables.sql` (`import_batches`,
  `import_profiles`, `source`-kolom op articles/inspections, bucket
  `imports`) — **nog door Jos uit te voeren in Supabase**. RLS uit, grant
  `authenticated`, zelfde patroon als de rest. Niet gebouwd: "update"-keuze
  bij een dubbel serienummer (nu alleen skip/toch-toevoegen), en koppeling
  aan afkeurcodes uit `rejection_codes` (afkeurtekst blijft vrije tekst in
  `comment`).

  **RLS-advies aan Jos (2026-06-26):** RLS blijft bewust UIT tijdens de bouw
  (er is nog maar één keurbedrijf, dus geen risico op data-inzage door
  derden). Het aanzetten gebeurt als één aparte, geteste beveiligingsronde
  vlak vóór er andere keurbedrijven/echte klanten bijkomen (zie fase 4 + de
  RLS-let-op onderaan deze sectie). Niet er tussendoor.

  ### Na het laatste bouwplan-bijwerken — polish + eerste live-test (26–27 juni)
  > Administratieve inhaalslag: de hieronder beschreven ~21 commits stonden nog
  > niet in dit bouwplan ("we hielden niet netjes bij waar we waren"). Niets is
  > losgeraakt — de branch staat gelijk met `main` (alles live). Op volgorde:

  **Excel/CSV-import afgemaakt + gepolijst (2026-06-26):** bovenop de eerste
  versie zijn de praktijkgevallen van Jos' eigen bestanden opgelost: **vaste
  klantnaam** voor bestanden zonder klantkolom, **vaste keuringsdatum** voor
  bestanden zonder datumkolom, **keuringsdatum optioneel** gemaakt, en
  **Categorie + Materiaal** toegevoegd aan de kolommapping. Een import **zonder
  keuringsdatum** maakt nu een **open concept-keuring** aan i.p.v. een afgeronde
  — de keurmeester kiest bij Starten zelf welke artikelen mee gaan. RLS
  expliciet uit op `import_batches`/`import_profiles`.
  **Keuring-flow herstructurering (2026-06-27):** keuringen-navigatie en
  klant-aanmaak-flow herzien; artikelen toevoegen op de **klantpagina** gebruikt
  nu dezelfde typeahead-flow als de keuring-wizard; de per-artikel
  checkbox-dialoog bij hervatten is vervangen door een simpele **"alles / alleen
  nieuw"**-keuze; bij het **hervatten van een open concept-keuring** kun je
  alsnog extra klant-artikelen bijpakken; **match-to-catalogus** voor een vrij
  (import-)artikel handmatig vanuit de wizard. Verder: verwijderde/afgevoerde
  artikelen blijven niet in beeld, recall-vlag weg bij vrije artikelen, en het
  certificaat sluit niet-beoordeelde artikelen uit; geen ❌ meer voor een
  niet-beoordeelde vórige keuring.
  **Eerste live-test van het certificaat — bug gevonden en gefixt
  (2026-06-27):** bij **"Afronden"** faalde de upload van de certificaat-PDF met
  *"new row violates row-level security policy"* (403 op de `certificates`
  Storage-bucket). Oorzaak: op de live database stonden naast de migratie-policies
  nog oude/handmatig via het dashboard aangemaakte policies op `storage.objects`
  die de upload blokkeerden. Opgelost door **álle** policies op `storage.objects`
  te resetten naar een schone, toestemmende bouwfase-set (ingelogde keurders
  mogen alles; publieke buckets `certificates`/`branding` ook anoniem leesbaar;
  privébuckets `imports`/`qualifications` alleen ingelogd). Idem voor het
  toevoegen van een **artikel** (`articles` had via de dashboard-UI per ongeluk
  weer RLS aan): generieke RLS-uit-sweep herhaald. Certificaat-opmaak na de test
  bijgesteld: **vinkje/kruisje** i.p.v. tekst, kolomvolgorde, serienummer op één
  regel, en **Bouwjaar** als uitschakelbare kolom. Levensduur-waarschuwing nu
  alleen naast het bouwjaar.
  **Code-review-opschoning (2026-06-27):** gedeelde logica naar de packages
  getrokken — `useAuth` naar `packages/core`, `useFieldSuggest` naar
  `packages/ui`, plus `errors.ts` (gecentraliseerde `errorMessage`), per-package
  `tsconfig.json` en een `tsconfig.base.json`. Robuustere certificaatflow en
  betere types.

  **⚠️ Migraties die in Supabase uitgevoerd moeten zijn (controleren!):** sinds
  de vorige bouwplan-stand zijn deze migraties bijgekomen. Ze zijn allemaal
  **idempotent** (veilig om opnieuw te draaien), dus bij twijfel gewoon (nog
  eens) uitvoeren in de SQL-editor:
  `20260627_disable_rls_articles`, `20260627_rejection_codes_per_company`,
  `20260628_certificate_branding`, `20260629_inspector_qualifications`,
  `20260630_company_address_extra`, `20260701_articles_free_norm_mbs`,
  `20260702_import_tables`, `20260703_certificates_storage_update_policy`,
  `20260703_reset_storage_policies`. Zonder de laatste twee faalt "Afronden"
  (certificaat-upload) live nog steeds; zonder `20260702` werkt de import niet.

  **Catalogus-wachtlijst-vinkje verplaatst (2026-06-27):** het vinkje "aanbieden
  voor de productendatabase" bij een vrij artikel stond in de keuring-wizard bij
  de invoervelden (vóór toevoegen). Het staat nu **per rij, rechts in de
  keuringstabel** (📚-icoon in de actiekolom, naast de prullenbak), zodat de
  keurmeester het artikel eerst toevoegt en pas daarna rustig markeert; opgeslagen
  per artikel op `articles.suggest_for_catalog` (geen migratie). Hetzelfde geldt
  nu voor het **klant-artikelformulier** (`CustomerArticles.vue`): het vinkje is
  daar weg bij de invoervelden en zit als 📚-toggle per rij in de artikellijst
  (alleen bij vrije artikelen). De échte
  goedkeurings-/curatorflow voor de wachtlijst (catalogus-wachtrij + god-rol)
  bouwen we bewust niet nu: die hoort in **fase 4** (besluit Jos 2026-06-27 —
  "volg het bouwplan"). Het vinkje verzamelt tot dan alleen de markeringen.

  **Handtekening keurmeester op het certificaat (2026-06-27):** elke keurmeester
  kan in **Instellingen → Keurmeesters** een handtekening uploaden (PNG/JPG, met
  preview, vervangen en verwijderen). Bij het afronden van een keuring wordt die
  handtekening in het certificaat-PDF ingebed, **boven de bestaande
  handtekeninglijn** (proportioneel geschaald; geen handtekening = lege lijn om
  met de hand te tekenen, zoals voorheen). Opgeslagen als `inspectors.signature_path`
  (migratie `supabase/migrations/20260704_inspector_signature.sql` — **nog door
  Jos in Supabase uit te voeren**, idempotent) met het bestand in de bestaande
  publieke `branding`-bucket (de handtekening komt sowieso op het publieke
  certificaat). De bedrijfsbrede certificaat-preview onder Instellingen toont de
  handtekening niet (die is per keurmeester, niet per bedrijf).

  > Detailvelden staan in **DATAMODEL.md**, niet in dit bouwplan: het bouwplan
  > is de fasering, het datamodel is de veldenbron.

  ### Offline-first (2026-06-30, op een feature-branch, nog niet naar `main`) {#offline-first}
  > Gestart op verzoek van Jos, met vooraf een gesprek over privacy/diefstal-
  > risico van lokaal opgeslagen klant-/bibliotheekdata (zie ontwerpkeuzes
  > hieronder). Branch: `claude/gearonimo-offline-first-phase2-2w9xpo`.

  **Ontwerpkeuzes (akkoord Jos 2026-06-30), afwijkend/aanvullend op
  BLAUWDRUK §8.1:**
  - **"Download per klant" i.p.v. automatisch alles syncen.** De keurmeester
    kiest expliciet welke klanten offline beschikbaar zijn (Netflix-
    downloads-model), met een snelkeuze "Vandaag" (klanten met een open
    concept-keuring) en "Deze week" (klanten met een keuringsitem dat binnen
    14 dagen vervalt — bewust een ruwe suggestie, geen vervanging van de
    next_due-berekening). Een download bevat alleen die klant, zijn
    artikelen en de catalogusproducten die daarbij horen — niet de hele
    klanten-/productendatabase (dataminimalisatie/AVG + beperkt het
    "bibliotheek gestolen"-risico bij verlies van een toestel).
  - **Lokale versleuteling: AES-256-GCM (Web Crypto API) + lokale PIN.** De
    sleutel wordt met PBKDF2 afgeleid van een PIN die de keurmeester zelf
    instelt (los van zijn inlogwachtwoord) en nooit opgeslagen — alleen een
    salt + check-waarde staan onversleuteld lokaal om een foute PIN te
    herkennen. Bewuste, met Jos gedeelde beperking: wie zowel het toestel als
    de PIN heeft, kan bij de data (zoals bij elke offline-app). PIN-reset kan
    alleen online (forceert een Supabase Auth-roundtrip) en wist alle lokale
    offline-data onherroepelijk (oude sleutel is weg) — expliciet een laatste
    redmiddel, geen "wachtwoord vergeten"-gemaksknop.
  - **Forensisch watermerk i.p.v. cryptografisch onvervalsbaar HMAC.** Geen
    edge-function-infrastructuur beschikbaar (zelfde pragmatische keuze als
    de client-side certificaat-PDF), dus geen geheime server-sleutel om een
    HMAC mee te ondertekenen. In plaats daarvan: elke download zet een rij
    in een nieuwe server-side logtabel `offline_downloads` (keurbedrijf,
    keurmeester, klant, tijdstip) — niet door de keurmeester zelf te
    vervalsen, en blijft bestaan ook als de lokale kopie verwijderd/gelekt
    is. Geen kopieerbeveiliging, wel een audit-spoor.
  - **Opruimen losgekoppeld van uploaden.** Uploaden van mutaties blijft
    altijd eager zodra er verbinding is (werkt prima met schommelend wifi).
    Een download wordt pas automatisch verwijderd als er geen openstaande
    mutaties meer zijn én een tijdje geen activiteit was — een korte
    wifi-flits trekt dus niet meteen de download weg terwijl de keurmeester
    nog met die klant bezig is. Nooit automatisch verwijderen van
    niet-gesynchroniseerde data; na 14 dagen alleen een waarschuwing +
    handmatige verwijderknop (slice 4).
  - **Nieuw product tijdens een offline keuring:** geen brede catalogus-
    download nodig — valt terug op het bestaande "vrij artikel"-mechanisme
    (`free_*`-velden), zoals nu al voor onbekende producten gebeurt.

  **Slice 1 — PWA + offline app-shell (af, 2026-06-30):** `vite-plugin-pwa`
  toegevoegd aan `apps/inspector`; service worker precachet de hele
  app-shell zodat de app ook zonder netwerk opent, met navigatie-fallback
  naar `index.html` voor elke route (zelfde idee als de bestaande
  404→index.html-truc van GitHub Pages, nu voor de service worker). Eerste
  manifest-icoon hergebruikt het bestaande Gearonimo-merk
  (`composables/gearonimoMark.ts`). Geverifieerd met een headless
  Playwright-run (production build + `vite preview`, browsercontext echt
  offline gezet): app-shell laadt en navigeert offline.

  **Slice 2 — Download-per-klant + versleutelde cache + watermerk (af,
  2026-06-30):** nieuwe offline-laag in `packages/core/src/offline/`
  (`db.ts` met `idb`, `crypto.ts`, `pinSession.ts`, `cache.ts`,
  `download.ts`) + nieuwe app-laag `apps/inspector/src/composables/useOffline.ts`
  en pagina `pages/OfflineDownloads.vue` (tegel "Offline downloads" op het
  hoofdmenu, route `/offline`) met PIN-dialoog
  (`components/OfflinePinDialog.vue`). Migratie
  `supabase/migrations/20260705_offline_downloads.sql` (**nog door Jos in
  Supabase uit te voeren**) voor het watermerk-logboek. Unit-tests voor de
  crypto-laag (round-trip, foute PIN, unieke IV per versleuteling) en de
  cache-laag (versleuteld-op-schijf-check, per-klant isolatie, product-
  opruiming) — `packages/core` test-suite groen. i18n nl/en onder `offline.*`.
  Lezen-uit-cache-koppeling in de bestaande klant-/keuringsschermen en de
  mutatiewachtrij/sync-engine volgen in slices 3-4.

  **Slice 3 — Offline schrijven via mutatiewachtrij (af, 2026-06-30):**
  mutatiewachtrij (`packages/core/src/offline/mutationQueue.ts`) en een
  lokale keuringscache (`inspectionCache.ts`) toegevoegd, plus twee nieuwe
  IndexedDB-stores (`inspections`, `inspectionItems`). Conflictstrategie
  zoals besloten: insert-mutaties zijn losse wachtrij-rijen, herhaalde
  update-mutaties op hetzelfde record (zelfde tabel + id) worden
  samengevoegd tot één openstaande mutatie i.p.v. een mutatie per
  toetsaanslag (last-write-wins, in volgorde af te spelen door de
  sync-engine van slice 4).

  `apps/inspector/src/composables/useInspections.ts` is omgebouwd tot een
  online/offline-dispatcher: elke functie (`ensureInspector`,
  `fetchArticleScope`, `startInspectionWithArticles`, `findDraftInspection`,
  `addArticlesToInspection`, `findPreviousResult`, `fetchRejectionCodes`,
  `fetchFreeInputFields`) controleert de verbindingsstatus en valt offline
  terug op de lokale cache/wachtrij — de online-tak is **ongewijzigd**
  overgenomen uit de bestaande, werkende code. Hierdoor hoefden
  `CustomerDetail.vue` en `InspectionNew.vue` (Start/Hervat-knop) niet
  aangepast te worden: zij roepen dezelfde functies aan als voorheen.
  Keuring-id's en item-id's worden offline client-side gegenereerd
  (`crypto.randomUUID()`) i.p.v. door de server; de certificaatnummering
  (`JJJJMMDD-KLANTNAAM`, geen volgnummer) loopt hier niet doorheen en heeft
  dus geen botsingsrisico.

  In `InspectionWizard.vue` (het daadwerkelijke invullen) is een aparte
  `loadOffline()`-tak toegevoegd naast de bestaande `load()` — bewust een
  los pad i.p.v. de bestaande, beproefde online-query's te doorspekken met
  if/else, zodat de online-code onaangeroerd blijft. Dekt het kernscenario
  (een al gedownloade keuring offline hervatten/invullen: resultaat,
  afkeurcode, opmerking, volgende-keuringsdatum); `saveRow()` schrijft
  offline naar de lokale cache + wachtrij i.p.v. rechtstreeks naar Supabase.
  **Bewust nog niet offline meegenomen** (blijven online-only, falen
  netjes met een netwerkfout i.p.v. de app te laten crashen): een nieuw vrij
  artikel toevoegen tijdens de keuring, artikelgegevens corrigeren
  (`saveArticle`), een artikel afvoeren/verwijderen (`retireArticle`), de
  handleiding-link bewerken, en afronden/certificaat genereren (`finish()` —
  hoort bij slice 5, certificaatupload kan sowieso niet zonder netwerk).
  Reden voor deze afbakening: `InspectionWizard.vue` is een groot,
  intensief stuk UI (zoek-suggesties, SN-zoeken, catalogus-matching) dat
  niet live tegen een echte Supabase-sessie te testen was in deze sessie;
  de kernhandeling (resultaten invullen) is voorzichtig en additief
  toegevoegd, de rest blijft ongemoeid tot een volgende sessie met
  Jos' akkoord/test hierop verder bouwt.

  Nieuwe unit-tests: mutatiewachtrij (coalescing van herhaalde updates,
  geen samenvoeging na het starten van sync, telling per klant) en
  keuringscache (round-trip, draft-opzoeken, patch-merge, lokale
  "vorige keuring"-hint, verzamelen van lokaal beoordeelde artikel-id's) —
  `packages/core` test-suite groen (29 tests). `vue-tsc`- en
  productiebuild van `apps/inspector` slagen.

  **Slice 4 — Sync-engine + opruimlogica (af, 2026-06-30):**
  `packages/core/src/offline/syncEngine.ts` speelt de hele mutatiewachtrij
  sequentieel af zodra er verbinding is (nooit parallel: een keuring-insert
  moet vóór de inserts van zijn eigen keuringsitems landen, de
  FK-afhankelijkheid die de wachtrij-volgorde al garandeert). Inserts gaan
  via `upsert` op de client-gegenereerde id (idempotent bij een afgebroken
  eerdere poging); updates via `update().eq()`, met de match-kolom uit de
  payload gehaald. Een mislukte mutatie wordt `failed` gezet (blijft in de
  wachtrij voor een volgende poging, met foutmelding) zonder de rest van de
  wachtrij — andere klanten — te blokkeren.

  **Opruimen, zoals besloten met Jos (2026-06-30):** losgekoppeld van
  uploaden. Een download wordt pas automatisch verwijderd
  (`cleanupSyncedDownloads`) als die klant **geen openstaande mutaties meer
  heeft** én **minimaal 4 uur niet actief gebruikt is** (`lastActivityAt`,
  bijgewerkt bij starten/hervatten/invullen van een keuring) — een korte
  wifi-flits halverwege de dag trekt zo niet de download weg terwijl de
  keurmeester nog bezig is. Nooit data verwijderen die nog niet
  gesynchroniseerd is: na 14 dagen zonder sync toont de downloadlijst een
  waarschuwing (`isDownloadStale`) met alleen een **handmatige**
  verwijderknop. Handmatig verwijderen is zelf ook beveiligd: `removeDownload`
  weigert (tenzij `force`) als er nog openstaande mutaties voor die klant
  zijn, zodat de "verwijder download"-knop in de UI nooit per ongeluk
  niet-gesynchroniseerd werk weggooit.

  **UI:** `apps/inspector/src/composables/useOffline.ts` houdt
  `pendingTotal` (som van openstaande mutaties), `syncing` en
  `lastSyncSummary`/`lastSyncError` bij, en triggert automatisch
  `syncAll()` zodra de browser `online` wordt (`useOnline`). Nieuwe globale
  `components/SyncStatusBar.vue` (in `App.vue`, dus op elk scherm
  zichtbaar) toont een vaste balk onderaan zodra er iets te melden is
  (offline, of nog wijzigingen in de wachtrij) met een **"Nu
  synchroniseren"-knop** (voor 's avonds thuis). De downloadlijst
  (`OfflineDownloads.vue`) toont per klant het aantal openstaande mutaties
  en de 14-dagen-waarschuwing.

  Nieuwe unit-tests voor `syncEngine.ts` (volgorde, upsert/update-onderscheid,
  falen+doorgaan-met-andere-klant, "gesynchroniseerd op"-markering, opruimen
  na inactiviteit, **niet** opruimen bij recente activiteit) met een
  gemockte Supabase-client (geen echte backend nodig) — `packages/core`
  test-suite groen (40 tests). `vue-tsc` en productiebuild van
  `apps/inspector` slagen; offline-app-shell-smoketest (Playwright,
  productiebuild + browser echt offline) blijft foutloos met de nieuwe
  syncbalk erin. Terloops gefixt: ontbrekende favicon (404 in de
  browserconsole, losstaand defect, geen regressie).

  **Slice 5 — Certificaat-flow afgestemd op offline (af, 2026-06-30,
  laatste slice van deze ronde):**

  - **Certificaatnummering geverifieerd** (gevraagd in de oorspronkelijke
    opdracht): `useCertificate.ts` bouwt het nummer als
    `JJJJMMDD-KLANTNAAM` (datum + klantnaam), **geen oplopend volgnummer**.
    Vooraf-reservering van nummers (zoals BLAUWDRUK §8.1 vanuit een
    sequentieel scenario noemt) is met dit schema dus niet nodig —
    toegelicht met een code-comment op de plek zelf, zodat dit niet
    opnieuw uitgezocht hoeft te worden.
  - **PDF blijft client-side, upload + record uitgesteld tot sync** (de
    geaccepteerde consequentie uit BLAUWDRUK §8.1): `finish()` in
    `InspectionWizard.vue` krijgt een offline-tak die **geen**
    certificaat probeert te genereren (dat heeft sowieso een
    Storage-upload nodig) maar de keuring lokaal markeert met een nieuwe,
    **lokale-only** status `pending_completion` (bestaat nooit in de
    database, alleen in de cache — zie `inspectionCache.ts`). Dit houdt
    "Hervat" op de klantpagina correct (een afgeronde-maar-niet-gesynchroniseerde
    keuring hoort niet meer als concept aangeboden te worden) zonder al
    "completed" te beweren vóórdat het certificaat er echt is. De wizard
    toont in dat geval een duidelijke "wacht op synchronisatie"-melding
    i.p.v. de downloadlink.
  - **Nieuwe app-laag `composables/useOfflineSync.ts`**:
    `completePendingInspections()` wordt ná elke generieke sync-ronde
    aangeroepen (`useOffline.ts` → `runSync()`, dus zowel bij automatische
    reconnect-sync als de handmatige knop) en genereert dan alsnog het
    certificaat via de **ongewijzigde**, bestaande `generateCertificate()`
    — er is nu wél weer netwerk, dus die kan gewoon zijn normale werk doen
    — en zet de keuring pas dáárna echt op `completed`. Mislukt dit
    (bv. nog geen verbinding voor de Storage-upload), dan blijft de
    keuring op `pending_completion` staan voor een volgende synchronisatie.
    Bewust een app-laag-functie, niet in `packages/core`: de PDF-generator
    (`pdf-lib`) hoort bij de app, niet bij de generieke offline-kern.
  - **Bundle-grootte-regressie gevonden en gefixt tijdens het bouwen:**
    `useOffline.ts` wordt al bij het opstarten geladen (de globale
    `SyncStatusBar`); een statische import van `useOfflineSync.ts` trok
    daardoor `pdf-lib` (~470 kB) mee de hoofdbundel in (911 kB i.p.v. de
    eerdere ~440 kB). Opgelost met een dynamische `import()` binnen
    `runSync()`, zodat `pdf-lib` pas geladen wordt op het moment dat er
    daadwerkelijk gesynchroniseerd wordt — niet als onderdeel van de
    offline-app-shell zelf (zie slice 1: die moet juist licht blijven).
  - **Edge case afgedicht:** her-downloaden van een klant met een lokaal
    nog niet gesynchroniseerde `pending_completion`-keuring overschreef
    eerst per ongeluk die lokale status met de (nog steeds "draft")
    serverversie — `downloadCustomer` in `download.ts` slaat die
    overschrijving nu over als de lokale keuring al `pending_completion` is.
  - Nieuwe unit-tests voor `markInspectionPendingCompletion`/
    `listInspectionsPendingCompletion` (status-overgang, uitsluiting uit
    "hervatbaar concept", verzamelen van keuringen die nog op een
    certificaat wachten) — `packages/core` test-suite groen (42 tests,
    49 met `packages/ui` erbij). `vue-tsc` en productiebuild van
    `apps/inspector` slagen; offline-app-shell-smoketest blijft foutloos.

  **Hiermee zijn alle 5 geplande slices van offline-first af** (zie de
  ontwerpkeuzes bovenaan deze sectie). **Bewust nog niet meegenomen in
  deze ronde** (gedocumenteerd bij slice 3, blijven online-only): nieuw
  vrij artikel toevoegen tijdens een offline keuring, artikelgegevens
  corrigeren/afvoeren vanuit de wizard, de handleiding-link bewerken, en
  het volledig offline doorzoeken van de globale catalogus (buiten wat
  voor de gedownloade klant is meegenomen). **Nog te doen vóór dit naar
  `main` kan:** de migratie `20260705_offline_downloads.sql` door Jos
  laten uitvoeren in Supabase, en een echte test op een toestel (incl.
  vliegtuigstand) — zie de samenvatting die bij het afronden van deze
  sessie is meegegeven.

  **Hardening-ronde na code review (2026-07-01, n.a.v. de live test van
  Jos, screenshots klantdetail + wizard):** volledige review van het
  offline-hoofdstuk hierboven plus alle offline-code; de gevonden punten
  zijn direct gefixt. Branch van deze ronde:
  `claude/offline-mode-code-review-g6haan`.

  - **Drie dataverlies-scenario's in de sync/opruimlaag gedicht** (de
    belangrijkste vondsten, alle drie met unit-tests):
    1. een update op een rij die nooit geland was (insert eerder in de
       keten gefaald) "slaagde" met 0 geraakte rijen en verdween stil uit
       de wachtrij — telt nu als fout en blijft staan;
    2. de opruimlogica kon een offline afgeronde keuring
       (`pending_completion`) wegtrekken vóórdat het certificaat bestond
       (die status telt niet als mutatie, en resultaten invullen/afronden
       registreerde geen activiteit voor de 4-uur-regel) — cleanup én
       `removeDownload` weigeren nu zolang zo'n keuring er staat, en
       `saveRow`/`finish` tellen als activiteit;
    3. `completePendingInspections` genereerde het certificaat ook als er
       nog gefaalde mutaties voor die klant openstonden (certificaat over
       onvolledige serverdata) — wacht nu tot de wachtrij leeg is.
    Plus: na een gefaalde mutatie slaat de sync de rest van diezelfde
    klant die ronde over (het comment beloofde dat al, de code deed het
    niet).
  - **Medewerkers en sets mee in de download** (de "TypeError: Failed to
    fetch" van de screenshots): IndexedDB-versie 2 met twee nieuwe stores;
    klantdetail, setslijst en setdetail lezen offline uit de cache,
    bewerken blijft online-only met verborgen knoppen. Her-downloads
    ruimen nu ook server-side verwijderde artikelen/leden/sets lokaal op
    (alleen bij een lege wachtrij, zodat offline aangemaakt werk nooit
    sneuvelt).
  - **Stille fouten in de wizard weg:** `saveArticle` (serienummer/
    bouwjaar/gebruiker/ingebruikname in de keurtabel) werkt nu ook offline
    via cache + wachtrij (faalde eerst volledig stil, wijziging weg na
    herladen); afvoeren/handleiding/catalogus-match blijven online-only
    maar zeggen dat netjes. De "Geen artikelen gevonden"-verwarring uit de
    tweede screenshot is een eigen tekst geworden ("geen match — vul aan
    en klik + Toevoegen"): de zoekvelden filteren de tabel, dat was geen
    bug maar zag eruit als één.
  - **Ontgrendelen vanaf elk scherm:** de PIN-dialoog zat alleen op de
    pagina Offline downloads; wie de app offline heropende zag overal
    "vergrendeld"-fouten zonder uitweg. De sync-statusbalk heeft nu een
    ontgrendelknop, de offline-schermen herladen na het ontgrendelen
    vanzelf (bewust geen pagina-reload: de sleutel leeft alleen in het
    geheugen), en offline afgeronde keuringen die op hun certificaat
    wachten tellen sleutelloos mee in de balk. Ontgrendelen triggert
    (online) meteen een sync, zodat zo'n certificaat niet tot een
    toevallige volgende sync blijft hangen.
  - **Artikeldetail offline leesbaar** (laatste doodlopende klik vanuit de
    artikellijst) en de "vorige keuring"-hints laden offline in één
    decryptie-ronde i.p.v. O(n²) (merkbaar op een tablet bij grote sets).
  - **Bekende, geaccepteerde beperking (bewust zo gelaten):** de
    payloads in de mutatiewachtrij staan onversleuteld in IndexedDB
    (inclusief resultaten/serienummers uit `article_snapshot`). Versleutelen
    zou betekenen dat synchroniseren een ontgrendelde PIN-sessie vereist,
    terwijl de wachtrij juist ook vergrendeld moet kunnen uploaden (eager
    sync bij reconnect). De wachtrij is normaal kort(stondig); de
    AES-GCM-laag beschermt de langlevende cache. Expliciet hier vastgelegd
    zodat dit niet als vergeten gat wordt aangezien.
  - `packages/core`-tests: 52 groen (was 42). `vue-tsc` + productiebuild
    slagen; hoofdbundel blijft ~440 kB (pdf-lib blijft lazy); offline-
    app-shell-smoketest (Playwright, productiebuild + browser echt
    offline) opnieuw gedraaid en groen.
- **Live:** de inspector-app draait op **https://gearonimo.net** (GitHub
  Pages; auto-deploy bij elke push naar `main`, zie
  `.github/workflows/deploy.yml`). De repo is daarvoor **openbaar** gemaakt.
- **Beveiliging (bijgewerkt 2026-07-02):** RLS staat sinds slice 3.2 **AAN**
  op alle public-tabellen (migratie `20260713_rls_enable.sql`, zie fase 3
  hieronder). De eerdere bouwfase-situatie (RLS uit + brede GRANTs aan
  `authenticated`) is daarmee afgesloten. Noodrem: `supabase/rls-rollback.sql`
  zet alles in één keer terug als er midden op een keurdag iets blokkeert.
- **Passkey-login (vingerafdruk/Face ID) in de klant-app (2026-07-16):** Jos
  wilde af van de magic-link-per-mail bij elke login. Supabase Auth heeft
  sinds eind mei 2026 native (bèta) passkey/WebAuthn-ondersteuning; dat is nu
  aangesloten in plaats van een eigen WebAuthn-implementatie. `useAuth.ts`
  (packages/core) kreeg `registerPasskey`/`signInWithPasskey`/`listPasskeys`/
  `deletePasskey` + capability-checks (`passkeySupported`,
  `platformAuthenticatorAvailable`). Flow: na de **eerste** magic-link-login
  op een toestel toont het dashboard automatisch een aanbod
  (`PasskeyPrompt.vue`, besloten met Jos: automatisch i.p.v. verstopt in
  Instellingen) om vingerafdruk/Face ID te activeren voor dát toestel; bij
  "Ja" wordt een passkey geregistreerd en onthoudt de app dit lokaal
  (`localStorage`, per toestel — dat is ook precies wat een platform-passkey
  is). Volgende keer toont het loginscherm dan een
  "Log in met vingerafdruk/Face ID"-knop vóór het mailformulier (die blijft
  altijd als terugvaloptie staan). Beheer van gekoppelde toestellen
  (toevoegen/verwijderen) staat in Instellingen → Beveiliging.
  **Bèta-kanttekening**: Supabase's passkey-API kan nog wijzigen; **Jos moet
  zelf** de Relying Party (naam, domein, toegestane origins) instellen in het
  Supabase Dashboard onder Authentication → Passkeys voordat dit in productie
  werkt — zonder die configuratie geeft `registerPasskey`/`signInWithPasskey`
  een fout. Geen migratie nodig (Supabase beheert de passkey-tabellen zelf).
  Nieuw icoon `fingerprint` toegevoegd aan het gedeelde `GIcon`
  (packages/ui), zelfde dun+rond-stijl, visueel gecheckt met headless
  Chromium vóór gebruik.

Uitgangspunten:

- **Elke fase eindigt met iets dat Jos kan vasthouden en testen.** Geen
  maanden bouwen in het donker.
- **De huidige apps blijven onaangeraakt draaien** tot GearCert zich in de
  praktijk bewezen heeft (schaduwdraaien, zie fase 2).
- **Veiligheidskritische rekenregels eerst en met tests**: next_due,
  statusberekening, regimes — daar mag nooit een fout in sluipen.
- Rolverdeling: Claude bouwt; Jos test, levert productkennis (catalogus,
  afkeurcodes, certificaatteksten) en regelt accounts/registraties.

---

## Fase 0 — Zakelijke fundering (acties Jos, ±een dagdeel)

Privé en zakelijk gescheiden vanaf dag één (besluit Jos 2026-06-12):

1. ~~**Domeinen registreren**~~ — uitgevoerd: **gearonimo.net** geregistreerd
   (bij Porkbun) en in gebruik als live-adres. (Oorspronkelijk plan noemde
   .io/.app/.nl/.eu; uiteindelijk .net gekozen.)
2. ~~**Zakelijk e-mailadres**~~ — uitgevoerd: **info@gearonimo.net** (via Zoho
   Mail). (Oorspronkelijk plan noemde jos@gearonimo.app/.nl.)
3. ~~**GitHub-organisatie**~~ — uitgevoerd: org **Gearonimo-app**.
4. ~~**Supabase-account**, nieuw project in EU-regio~~ — uitgevoerd:
   project buitfeiclivzzldfdelp (EU).
5. ~~Merkcheck~~ gedaan (TMview: alleen beëindigd Mattel-merk klasse 28 —
   geen blokkade). Nog doen: **naam checken in App Store en Play Store**.
6. *Pas later nodig:* Stripe-account (fase 5), Apple Developer $99/jaar en
   Google Play $25 eenmalig (fase 5), EU-merkregistratie ~€850, klasse 9 +
   42 (bij lancering).

## Fase 1 — Skelet en kern (±2–3 bouwsessies)

- Monorepo opzetten (packages/core, packages/ui, apps/inspector,
  apps/customer) met automatische bouw/test-pijplijn op GitHub.
- Databaseschema als migraties (rechtstreeks uit `DATAMODEL.md`), RLS-regels
  per rol, seed met de keuringsregime-tabel (NL/VK-defaults uit het
  onderzoek).
- Vertaalskelet nl + en-GB; domeinlogica (next_due, statusberekening,
  regime-resolutie) **met unit-tests**.
- Inloggen + rollen werkend in beide apps (web).
- **Testbaar resultaat:** Jos kan inloggen in twee lege maar echte apps.

## Fase 2 — De keurmeester-flow, het hart (±4–6 bouwsessies)

- Klanten, artikelen, winkel-catalogus (eenmalige import van de huidige
  producten-tabel van Safety Green als startcatalogus).
- Keuring-wizard volgens `UX-FLOW.md`: Start/Hervat-contextknop, artikelen
  klaargezet uit vorige keuring, SN-suffix-zoeken, tik-flow,
  afrondscherm met aantallen, recall-vlag.
- **Offline:** lokale opslag op het toestel + sync-laag (route 1),
  automatische upload bij verbinding + handmatige sync-knop.
- **Certificaat-PDF server-side** met hash + verificatie-QR, archivering in
  Storage; verificatiepagina (scan → echt record).
- **Mijlpaal — schaduwdraaien:** Jos doet één echte keurdag volledig in
  GearCert náást de huidige werkwijze en vergelijkt: sneller? niets gemist?
  certificaat goed? Pas door naar fase 3 als dit klopt.

## Fase 3 — De klant-app (±2–3 bouwsessies)

> **Slice 3.1 gebouwd (2026-07-02, branch
> `claude/offline-mode-code-review-g6haan`):** de klant-app leeft op
> **gearonimo.net/klant/** (zelfde Pages-deploy, hash-router; de
> inspector-service-worker heeft een denylist voor /klant zodat hij daar
> niet zijn eigen shell serveert). Magic-link-login (wachtwoordloos, zoals
> besloten 2026-06-14), koppelen via **uitnodigingscode** per klantbedrijf
> (`customers.invite_code`, zichtbaar + kopieerbaar op het klantdetail in
> de inspector-app), dashboard **"ben ik in orde"** (stoplicht + tellers,
> statuslogica = de geteste `calcStatus` uit packages/core; afgekeurd bij
> laatste keuring telt als actie-nodig), artikellijst met status/
> handleiding/recall/volgende-keuringsdatum, en **certificaten downloaden**.
>
> **Vertrouwensmodel:** RLS staat nog uit, dus de klant-app leest álles via
> security-definer-RPC's die zelf op `auth.uid()` scopen (`my_customer`,
> `my_articles`, `my_certificates`, `join_customer_by_invite`) — geen
> directe tabel-toegang nodig. `ensure_inspector` is dichtgetimmerd:
> klant-accounts worden niet langer automatisch keurmeester als ze de
> inspector-app openen. **Maar let op:** zolang de brede GRANTs aan
> `authenticated` bestaan kan een technisch onderlegde klant nog steeds
> rechtstreeks de REST-API bevragen. **Daarom: nog géén uitnodigingscodes
> aan echte klanten geven vóór de RLS-ronde** — die is nu de eerstvolgende
> geplande slice (3.2).
>
> **Acties Jos vóór het testen:**
> 1. Migratie `supabase/migrations/20260708_customer_app_join_and_reads.sql`
>    uitvoeren in Supabase (idempotent).
> 2. In Supabase → Authentication → URL Configuration:
>    `https://gearonimo.net/klant/*` toevoegen aan **Redirect URLs**
>    (anders landt de magic-link op de inspector-app).
> 3. Testen: /klant/ openen, inloggen met een e-mailadres, koppelen met de
>    uitnodigingscode van een testklant (staat op het klantdetail in de
>    inspector-app), dashboard controleren.
>
> **Live getest door Jos (nacht 1→2 juli): werkt end-to-end** (login,
> koppelen, dashboard, certificaat-downloads). Onderweg gevonden en gefixt:
> live miste `customer_members.email` e.a. kolommen én de user_id-FK wees
> naar public.users i.p.v. auth.users (migraties 20260709/20260710 —
> hetzelfde "tabel was ouder dan de migratie"-patroon als eerder bij
> inspectors; zie de schema-diff hieronder bij slice 3.2). Direct daarna
> op verzoek van Jos gebouwd: **afvoeren door de klant** (elk eigen
> artikel, met reden — vervangen/verloren/gestolen; migraties
> 20260711/20260712, RPC `retire_my_article`), subtiel prullenbakje +
> ✓/✗-statuschips, en in de **wizard-SN-zoeker** blijven afgevoerde
> artikelen vindbaar ("Afgevoerd (reden)", laatste keuringsresultaat
> erbij, klik = weer in gebruik nemen + toevoegen aan de keuring).
>
> **Slice 3.2 — RLS-ronde (volgende):** de database echt op slot nu er
> externe accounts bestaan. Plan:
> 1. **Schema-diff live ↔ repo-migraties** (introspectie-dump door Jos,
>    diff door Claude) zodat alle "tabel ouder dan migratie"-verrassingen
>    in één keer boven water komen vóór er policies op gebouwd worden.
> 2. `customer_links`-backfill (elke klant gekoppeld aan het keurbedrijf)
>    — de policies scopen inspectors via die tabel.
> 3. RLS aan op alle tabellen: inspectors zien/schrijven alles van hun
>    eigen keurbedrijf (via `customer_links`); klant-accounts hebben géén
>    directe tabel-toegang (alles loopt al via security-definer-RPC's);
>    `products` leesbaar voor alle ingelogden (catalogus).
> 4. `ensure_inspector` stopt met auto-provisioning: bestaande
>    keurmeesters blijven werken, nieuwe komen er alleen via het
>    beheerscherm/een uitnodiging (het huidige gedrag maakt elk
>    zelf-geregistreerd account keurmeester — onhoudbaar met een publieke
>    klant-login).
> 5. Pas daarna: uitnodigingscodes naar echte klanten.
>
> **Slice 3.2 gebouwd + live getest (2026-07-02):** de RLS-migratie
> (`supabase/migrations/20260713_rls_enable.sql`) is gebouwd op de
> introspectie-dump van Jos — niet op aannames — en draait live. Kern:
> RLS aan op alle public-tabellen; keurmeesters (actieve `inspectors`-rij)
> zien/bewerken alles van hun eigen bedrijf via `customer_links` (met
> definer-helpers tegen policy-recursie); klant-accounts hebben géén
> directe tabel-toegang (alles via de security-definer-RPC's); catalogus
> leesbaar voor ingelogden; TRUNCATE/REFERENCES/TRIGGER ingetrokken;
> Storage schrijven alleen nog voor keurmeesters (een klant-account kon
> eerst certificaat-PDF's overschrijven); `ensure_inspector` provisioneert
> niet langer elk nieuw account tot keurmeester. De schema-diff bracht ook
> drie losse live-gebreken boven water die meteen zijn rechtgezet
> (`customer_members.user_id` onterecht NOT NULL; ontbrekende
> DELETE-grants op `articles` en `certificates`). Noodrem:
> `supabase/rls-rollback.sql` (bewust géén migratie) zet alles in één keer
> terug. Jos' testronde leverde nog vier fixes/wensen op, alle gebouwd:
> uitlogknop + duidelijke klant-account-melding in de Pro-app (de sessie
> wordt sinds de klant-app op hetzelfde domein gedeeld), router-guard die
> op de sessie-load wacht (hoofdmenu verscheen eerst zonder login), het
> witte scherm na de magic-link (auth-tokens in de URL-hash botsten met de
> hash-router), en in de wizard het Gebruiker-veld in de toevoegrij +
> certificaat-PDF's die echt als download in de Downloads-map landen.
> Daarmee is stap 5 vrijgegeven: **uitnodigingscodes kunnen naar echte
> klanten** (actie Jos, het fase-3-mijlpaalmoment).
>
> **Slice 3.3 gebouwd (2026-07-02): klantbedrijf-admin.** De twee
> resterende fase-3-bouwblokken voor de klant-app, volledig via nieuwe
> security-definer-RPC's (klant-accounts houden géén directe tabel-toegang;
> migratie `supabase/migrations/20260714_customer_admin.sql` — **nog door
> Jos uit te voeren in Supabase**, idempotent):
> - **Medewerkers beheren** (pagina `/medewerkers` in de klant-app, link in
>   de kopbalk): lijst met badges (beheerder/inactief/nog geen account),
>   toevoegen/bewerken (naam, functie, telefoon, e-mail, actief). Beheer is
>   voorbehouden aan **beheerders**: nieuwe boolean
>   `customer_members.is_admin` (zelfde patroon als `inspectors.is_admin`;
>   dit overrulet het `role='manager'`-idee uit DATAMODEL — `role` is in de
>   praktijk al vrije tekst voor de functie). Het **eerste account dat met
>   de uitnodigingscode koppelt wordt automatisch beheerder** (backfill
>   regelt dit ook voor bestaande koppelingen), en de keurmeester kan de
>   beheerder aanwijzen via een nieuw vinkje in het medewerkersscherm van
>   de inspector-app. Vergrendel-vangnet: je kunt jezelf niet inactief of
>   niet-beheerder maken. De beheerder ziet op de medewerkers-pagina ook de
>   **uitnodigingscode** van het bedrijf (kopieerbaar) met uitleg — collega
>   koppelt zelf, e-mail-hereniging plakt account en medewerker-rij aan
>   elkaar. Lijst is leesbaar voor elk actief lid (zichtbaarheid per
>   bedrijf, DATAMODEL-besluit 2026-06-14); alleen bewerken is
>   beheerder-werk.
> - **Artikelen toevoegen door de klant** ("+ Toevoegen" bij Materiaal op
>   het dashboard, mag elk actief lid — zelfde lijn als afvoeren): zoeken
>   in de catalogus via de bestaande fuzzy `search_products` (werkt voor
>   klant-accounts dankzij de products-leespolicy uit 20260713), of vrije
>   invoer als het product er niet tussen staat — die gaat dan automatisch
>   de **catalogus-wachtrij** in (`suggest_for_catalog`, "onbekend product
>   → wachtrij" uit het faseplan). Velden: serienummer, gebruiker,
>   bouwjaar/-maand, in-gebruik-sinds. Nieuwe artikelen krijgen
>   `source='customer'` (check-constraint verruimd) zodat de keurmeester
>   ziet waar het vandaan komt.
> Beide apps bouwen groen (vue-tsc + vite), 54 core-tests groen. Nog te
> doen: live-test door Jos (migratie uitvoeren → medewerker toevoegen,
> collega laten koppelen, artikel toevoegen mét en zónder catalogusmatch).
> Migratie 20260714 is door Jos uitgevoerd (2026-07-03) en de slice is naar
> `main` gemerged (live).
>
> **URL's naar het Engels (2026-07-03, op verzoek Jos):** de klant-app is
> verhuisd van `gearonimo.net/klant/` naar **`gearonimo.net/portal/`** —
> conform de afspraak "code/naamgeving in het Engels" (BLAUWDRUK §3), en
> `portal` i.p.v. `customer` omdat dat één letter scheelt met `/customers`
> (klantbeheer in de Pro-app) en een typfout dan in de verkeerde app landt.
> Hash-routes mee hernoemd: `#/koppelen` → `#/join`, `#/medewerkers` →
> `#/members`. Oude paden blijven werken: `/klant/` krijgt bij de deploy een
> doorverwijspagina die de `#`-hash behoudt (dus ook oude magic-links landen
> goed), en de oude hash-routes zijn router-redirects. In dezelfde ronde
> `/inspection/new` → `/inspections/new` (enkelvoud/meervoud-consistentie in
> de Pro-app, met redirect). Alle overige paden waren al Engels
> (gecontroleerd overzicht: /customers, /articles, /sets, /inspections,
> /serial-search, /settings, /import, /offline, /verify).
> **Actie Jos:** in Supabase → Authentication → URL Configuration
> `https://gearonimo.net/portal/*` toevoegen aan de Redirect URLs (en
> `/klant/*` mag daarna weg). **Gedaan (2026-07-03).**
>
> **Rollenoverzicht opgesteld + catalogus-curator-rol gebouwd (2026-07-03,
> vooruitgetrokken uit fase 4).** Op verzoek van Jos eerst een audit van
> alle rollen in de code (niet uit het geheugen): keurmeester (klanten +
> keuringen) en klant-admin/end-user waren al volledig gebouwd en
> afgedwongen; **keurbedrijf-admin** (`inspectors.is_admin`) bleek alleen
> een kolom + badge zonder enige afdwinging — elke keurmeester kon al
> alles. **Besluit Jos: dat mag zo blijven** (bedrijfsadmin en keurmeester
> gelijk; afkeurcodes/certificaat-template zijn al per keurbedrijf
> ingesteld, niet per keurmeester — dat klopte dus al). De vijfde rol,
> **"keurmeester die brondata aanvult"**, bleek niet te bestaan: RLS liet
> niemand in `products` schrijven (bewust, sinds de RLS-ronde). Besluit
> Jos: een **aparte curator-rol** — hij vertrouwt niet elke keurmeester om
> de catalogus zelf compleet/correct in te vullen, dus alleen een paar door
> hem aangewezen keurmeesters mogen rechtstreeks schrijven; de rest kan
> alleen een artikel op de wachtrij zetten (het bestaande
> `suggest_for_catalog`-vinkje) zodat Jos controleert vóór het de
> bibliotheek in gaat — plus zelf makkelijk in Excel kunnen bijwerken.
>
> Gebouwd (migratie `supabase/migrations/20260715_catalog_curator.sql` —
> **nog door Jos uit te voeren in Supabase**, idempotent): nieuwe
> `inspectors.can_curate_catalog` (losstaand van `is_admin`; de oudste
> inspector — vrijwel zeker Jos — wordt als enige automatisch curator via
> backfill), RLS-schrijfbeleid op `products` voor curators
> (`is_catalog_curator()`-helper). Nieuwe Instellingen-tegel **Catalogus**
> (alleen zichtbaar voor een curator) met twee onderdelen:
> - **Wachtrij** (`CatalogQueue.vue`) — alle `suggest_for_catalog`-artikelen,
>   per stuk voorgevuld met de vrije velden (merk/omschrijving/
>   categorie/materiaal/norm/MBS): curator vult de rest aan (type, leeftijds-
>   termijnen, handleiding-/recall-/veiligheidsbulletin-links) en maakt er
>   een echt `products`-record van (artikel wordt gekoppeld, vrije velden
>   blijven staan — onschadelijk, overal wint het gekoppelde product al via
>   coalesce), of wijst af (vinkje uit, geen product).
> - **Catalogus** (`CatalogManager.vue`) — volledige productenlijst met
>   zoeken, handmatig toevoegen/bewerken, **Excel-export** (`.xlsx`, alle
>   kolommen) en **Excel-import** met dryrun-preview (nieuw/bijgewerkt/
>   overgeslagen-met-reden vóór commit; matcht op `id`, ontbrekend `id` =
>   nieuw product) — zodat Jos de catalogus ook gewoon in Excel kan
>   bijwerken en terug importeren.
> Gedeeld veldenformulier `ProductForm.vue` (+ `productForm.ts` voor de
> types/defaults, buiten `<script setup>` omdat dat geen losse
> runtime-exports mag hebben) voorkomt dat wachtrij en catalogusbeheer twee
> keer dezelfde ~15 velden definiëren. Beide apps bouwen groen (vue-tsc +
> vite), 54 core-tests groen. Migratie door Jos uitgevoerd (2026-07-05).
>
> **Catalogus-aanmelding: van kaal vinkje naar ingevuld voorstel
> (2026-07-05, besluit Jos).** Het "aanbieden voor de catalogus" was een kaal
> boolean-vinkje (📚 per rij in `CustomerArticles.vue` en `InspectionWizard.vue`):
> de keurmeester zette het aan en liet merk/type/categorie/materiaal/norm/
> leeftijdstermijnen/MBS/handleiding-/recall-/veiligheidsbulletin-links volledig
> aan de curator over. Jos wil dat wie iets voorstelt zelf zijn best doet die
> velden in te vullen. Omgebouwd: het 📚-icoon is nu een **knop** die een
> **productformulier** opent (hergebruik van het bestaande `ProductForm.vue` via
> de nieuwe wrapper `CatalogSuggestDialog.vue`), voorgevuld met wat de
> keurmeester al in de vrije velden typte; pas na invullen + verzenden komt de
> aanmelding op de wachtrij. Brand + naam zijn verplicht (uit `ProductForm`);
> de rest presenteert het formulier, zodat de curator vooral controleert.
>
> **Schema:** de ingevulde velden gaan NIET meteen een `products`-rij in (die is
> leesbaar voor elke ingelogde zodra hij bestaat, RLS-leesbeleid 20260713 — een
> niet-goedgekeurd voorstel hoort nog niet in de echte catalogus). In plaats
> daarvan een nieuwe jsonb-kolom `articles.catalog_suggestion` naast het
> bestaande `suggest_for_catalog`-vinkje (migratie
> `supabase/migrations/20260716_catalog_suggestion.sql` — **nog door Jos in
> Supabase uit te voeren**, idempotent). Geen apart RLS-/grant-werk nodig: de
> eigenaar-keurmeester mag de articles-rij van zijn klant al muteren
> (`articles inspector all` + grant update uit 20260713; RLS is rij-, niet
> kolomgebaseerd). `CatalogQueue.vue` prefilled nu uit `catalog_suggestion`
> (i.p.v. alleen de schamele vrije velden) en valt daarop terug voor oudere/
> klant-app-aanmeldingen zonder voorstel; accepteren/afwijzen wist het
> voorstel weer. i18n nl+en onder `catalogSuggest`. Beide apps bouwen groen
> (vue-tsc + vite), 54 core-tests groen. Nog te doen: migratie uitvoeren +
> live-test door Jos (aanmelden vanuit klantpagina én keuring-wizard, curator
> ziet het voorgevulde voorstel in de wachtrij).
>
> **Klant-account kon toch alle Pro-app-schermen openen (bug, gevonden door
> Jos 2026-07-05).** Bij het testen bleek: een klant-account dat op
> gearonimo.net (i.p.v. /portal/) inlogt zag na de "dit is geen
> keurmeester-account"-melding gewoon het volledige tegelmenu ernaast staan
> — Klanten, Keuringen, Instellingen (incl. de Excel-import) waren allemaal
> aan te klikken. RLS blokkeerde al écht lezen/schrijven (leeg/geweigerd,
> geen datalek), maar de schermen zelf hoorden niet bereikbaar te zijn.
> Gefixt: het hoofdmenu verbergt de zoekbalk + tegels volledig zodra het
> account geen keurmeester is (`apps/inspector/src/pages/Home.vue`), én de
> router zelf controleert dit nu ook (`ensureInspector()` in
> `router.beforeEach`) zodat een directe URL of de terug-knop niet meer
> alsnog bij `/customers`, `/settings`, `/import` etc. uitkomt — alleen het
> hoofdmenu (met de melding + link naar `/portal/`) blijft toegankelijk.
>
> **"Wachtwoord vergeten" toegevoegd aan de Pro-app (2026-07-05, op verzoek
> Jos).** Er was geen enkele weg terug als je het wachtwoord van een
> keurmeester-account kwijt was — geen zelfregistratie, dus ook geen
> "wachtwoord vergeten"-link. Nu: een link op het inlogscherm stuurt via
> `resetPasswordForEmail` (nieuw in `useAuth`, `packages/core`) een
> reset-mail; die landt op de nieuwe pagina
> `apps/inspector/src/pages/ResetPassword.vue` (route `/reset-password`,
> bewust buiten de keurmeester-gate) waar een nieuw wachtwoord ingesteld
> wordt via `updatePassword`. **Actie Jos:** `https://gearonimo.net/reset-password`
> toevoegen aan Supabase → Authentication → Redirect URLs (zelfde plek als
> `/portal/*`), anders landt de reset-link niet goed.
>
> **Afgesproken met Jos: volgende sessie alle test-accounts opschonen.**
> Te veel losse e-mails/wachtwoorden uit eerdere test-rondes, overzicht
> kwijt. Plan: alle bestaande auth-accounts verwijderen (Supabase →
> Authentication → Users) en vervangen door één vast, opgeschreven setje —
> één per rol, zodat elke rol apart en herhaalbaar te testen is:
> 1. **Keurmeester** (gewoon account, `is_admin=false`, `can_curate_catalog=false`)
> 2. **Keurbedrijf-admin/keurmeester** (`is_admin=true`) — bewust geen apart
>    rechtenniveau (besluit Jos 2026-07-03), dus dit test-account bevestigt
>    vooral dat het vinkje zichtbaar is, niet dat er iets afwijkt
> 3. **Catalogus-curator** (`can_curate_catalog=true`) — ziet de
>    Catalogus-tegel in Instellingen
> 4. **Klant-admin** (eerste account dat met een uitnodigingscode koppelt,
>    `customer_members.is_admin=true`) — ziet Medewerkers in `/portal/`
> 5. **Klant end-user** (koppelt met dezelfde code, geen beheerrechten)
> Nieuwe accounts via **Add user** in Supabase (Auto Confirm User aan,
> zelf een wachtwoord kiezen) voor de keurmeester-rollen; klant-rollen
> loggen zelf in via de magic-link op `/portal/` en koppelen met de
> uitnodigingscode van een testklant.
>
> **Keuring aanvragen / de leadmotor gebouwd (2026-07-05, laatste openstaande
> stuk van fase 3).** Tot nu toe kon een klant zich alleen via een
> uitnodigingscode koppelen. Nu ook het bredere onboardingpad uit BLAUWDRUK §7
> / DATAMODEL §5 (`inspection_requests`). **Ontwerpbesluiten met Jos
> (gespard, niet uit de code):**
> - **Gearonimo is puur het platform/de matchmaker — géén keurbedrijf-rij die
>   klanten "bezit".** Dat zou het platform tot concurrent van zijn eigen
>   keurbedrijven maken (Jos keurt zelf bij Safety Green). Een zelf-aangemelde
>   klant staat daarom **op zichzelf, zonder koppeling**, tot hij zelf een
>   keurbedrijf kiest. Dashboard toont dan "nog niet gekeurd — vraag een
>   keuring aan" (geen rood alarm, BLAUWDRUK §7).
> - **Ontdekking = wereldkaart** (Leaflet/OpenStreetMap, geen API-sleutel) met
>   alle keurbedrijven die `listed=true` hebben, **plus naam-zoeken** (vindt
>   ook niet-gelijste bedrijven, BLAUWDRUK §7.3). **Geen landfilter** — een
>   NL-bedrijf mag Belgische klanten, buitenlanders in NL moeten hier terecht
>   kunnen (Jos); de klant kiest zelf op de kaart waar hij naartoe wil.
> - **Overstap = één keurbedrijf tegelijk** (`source='switch'`): bij
>   goedkeuring wordt de nieuwe koppeling actief en andere actieve koppelingen
>   beëindigd. **De historie reist mee met de klant**: het actueel gekoppelde
>   keurbedrijf mag de vólledige keuringshistorie/certificaten van die klant
>   inzien (alleen-lezen), ook wat een vórig keurbedrijf uitvoerde — klant is
>   eigenaar van de data (nieuwe SELECT-policies naast de bestaande
>   company-scope; bewerken blijft van het uitvoerende bedrijf, afgeronde
>   keuringen zijn sowieso onveranderlijk).
>
> **Ook opgeruimd:** de tijdelijke hack uit de een-bedrijf-fase — een trigger
> die élke nieuwe klant aan "het oudste bedrijf" koppelde — is herzien: een
> door een keurmeester aangemaakte klant koppelt nu aan *diens eigen* bedrijf;
> een zelf-aangemelde klant krijgt géén automatische koppeling.
>
> **Gebouwd (migratie `supabase/migrations/20260717_inspection_requests_leadmotor.sql`
> — nog door Jos in Supabase uit te voeren, idempotent):** `inspection_requests`
> + `inspection_companies.listed/latitude/longitude`; security-definer-RPC's
> `self_register_customer`, `list/search_inspection_companies`,
> `request_inspection`, `my_inspection_requests`, `withdraw_inspection_request`,
> `my_link_status` (klant-app) en `company_inspection_requests`,
> `accept/decline_inspection_request`, `set_company_listing`,
> `my_company_listing` (Pro-app). Safety Green is meteen `listed=true` gezet met
> de coördinaten van Elst (Gld) zodat het aanvraagpad te testen is (uit te
> zetten via Instellingen → Vindbaarheid).
> - **Klant-app:** startkeuze `Start.vue` (uitnodigingscode óf zelf beginnen),
>   `Request.vue` (wereldkaart + naam-zoeken + aanvraag + status/intrekken),
>   dashboard-banner voor een niet-gekoppelde klant / lopende aanvraag. Nieuwe
>   dep `leaflet` (lazy in de Request-chunk).
> - **Pro-app:** tegel **Aanvragen** (met badge) + `Requests.vue`
>   (goedkeuren/afwijzen), en Instellingen → **Vindbaarheid**
>   (`CompanyListing.vue`: listed-schakelaar + locatie).
> i18n nl+en. vue-tsc + vite (beide apps) + 54 core-tests groen. **Actie Jos:**
> migratie 20260717 uitvoeren; daarna testen: zelf-aanmelden → materiaal
> invoeren → keuring aanvragen (kaart/naam) → in de Pro-app goedkeuren →
> koppeling actief + historie zichtbaar.
>
> **Migraties uitgevoerd (2026-07-06):** Jos heeft `20260716_catalog_suggestion.sql`
> én `20260717_inspection_requests_leadmotor.sql` in Supabase gedraaid (beide
> "Success"). Safety Green staat daarmee live `listed=true` met de coördinaten
> van Elst. TAAK 1 (catalogus-aanmelding) en TAAK 2 (leadmotor) zijn hiermee
> volledig live op gearonimo.net.
>
> **A-Z testplan opgesteld (2026-07-06): `TESTPLAN.md` + `supabase/testdata-reset.sql`.**
> Op verzoek van Jos een volledige, stap-voor-stap doorloop (100 stappen, fases
> A–Q) vanaf een schone lei: testdata wissen → keurmeester aanmaken →
> bedrijfsinstellingen → klant + artikelen → catalogus-aanmelding →
> keuring+certificaat → SN/recall → sets → curator-wachtrij → Excel-import →
> klant-app (uitnodigingscode én zelf-aanmelden/leadmotor) → aanvraag
> goedkeuren → rollen-afscherming → wachtwoord-reset → offline → (optioneel)
> overstap met historie-meereizen. Elke stap heeft een "Verwacht:"-regel zodat
> Jos per stap ✅/❌ kan terugkoppelen. `testdata-reset.sql` wist de
> transactionele data + auth-accounts maar behoudt catalogus/bedrijf/afkeurcodes.
>
> **Styling-/opmaakronde (2026-07-14/15, met Jos live meetestend).** De
> UI-opmaak-pas die al langer open stond (en UX-FLOW §7's crowdsourced
> hero-foto) is gebouwd, plus onderweg gevonden bugs:
> - **Platform-hero-foto**: sfeerfoto op het hoofdmenu van beide apps én als
>   gedimde kopstrook op alle subpagina's. Instelbaar door de platform-admin
>   via Instellingen → Hero-foto: één bronfoto, drie crops
>   (mobiel/desktop/kopstrook) met inzoomen/uitlijnen en een
>   donkering-schuif, live voorbeeld; oude bestanden worden bij opslaan
>   opgeruimd. Nieuwe singleton-tabel `platform_settings` +
>   `is_platform_admin()`; opslag in de bestaande `branding`-bucket
>   (migraties `20260714`, `20260730` t/m `20260732` — alle door Jos
>   uitgevoerd). Onderweg gefixt: `platform_admins.user_id`-FK wees naar
>   `public.users` i.p.v. `auth.users` (derde keer dit patroon), en de tabel
>   miste een grant ("permission denied").
> - **Hoofdmenu's herbouwd**: glas-tegels (één stijl i.p.v. regenboogkleuren)
>   over de foto; Pro-app desktop = statkaart links ("N artikelen te
>   herkeuren binnen 30 dagen", nieuwe RPC `upcoming_reinspections_count`,
>   bewust géén "alles op orde"-tekst en geen vanity-tellers) + 2×3-tegels
>   rechts; zoekbalk van het hoofdmenu weg (dubbelop met de tegels).
> - **Gedeelde koppen**: de 12 losse, uit de pas gelopen paginakoppen van de
>   Pro-app vervangen door één `AppHeader` (terug+home links, titel midden,
>   actie-slot rechts); klant-app-pagina's Members/Request alsnog aan de
>   gedeelde `PageHeader`. De hero-kopstrook zit ín die componenten.
> - **Lijn-iconen i.p.v. emoji**: gedeeld `GIcon`-component
>   (`packages/ui`), stijl dun+rond, gekozen door Jos via een
>   preview-artifact; gereedschapskist voor "Mijn materiaal".
> - **Systeem-sans** als lettertype (er stond helemaal geen font-family —
>   alles viel terug op Times New Roman); bewust geen webfont
>   (offline-first + AVG).
> - **Twee ernstige bugs gevonden en gefixt**: (1) supabase-js-deadlock —
>   een query bínnen de `onAuthStateChange`-callback blokkeerde de hele
>   klant-app op "Laden..." (fix: `setTimeout` buiten de callback-tick;
>   boot headless geverifieerd); (2) verouderde PWA-chunks na een deploy
>   lieten tegel-kliks stil falen (fix: `router.onError` + eenmalige
>   reload, beide apps).
> - **`CLAUDE.md` toegevoegd** met de werkafspraken/landmijnen uit deze
>   ronde, zodat volgende sessies ze automatisch meekrijgen.

- Dashboard "ben ik in orde", artikelen + historie, certificaten downloaden,
  handleiding-links.
- Keuring aanvragen: uitnodigingscode/QR, openbare lijst met
  "open voor nieuwe klanten"-schakelaar, naam-zoeken (leadmotor,
  blauwdruk §7).
- Klantbedrijf-admin: medewerkers beheren, artikelen toevoegen
  (catalogus-autocomplete; onbekend product → wachtrij).
- **Mijlpaal:** één echte klant van Safety Green als pilotgebruiker.

## Fase 4 — Migratie en overstap Safety Green (±2 bouwsessies)

> **Herzien 2026-07-19 (besluit Jos):** het DB-naar-DB-migratiescript is
> **geschrapt** — alle oude data staat dubbel op de zaak (incl. PDF's).
> Testklanten krijgen een uitnodigingscode en beginnen leeg; historie kan
> desgewenst per klant via de bestaande Excel/CSV-import. De
> catalogus-wachtrij + god-rol zijn al actief (2026-07-03/19, incl.
> platform-admin los van een keurbedrijf en de Bedrijven-tegel).

- ~~Migratiescript oude Supabase → nieuw schema~~ — geschrapt, zie boven.
- ~~Catalogus-wachtrij + god-rol actief~~ — af (2026-07-03/19).
- NAS-back-up ingeregeld (blauwdruk §8) — **wacht op het aansluiten van de
  NAS (hardware, actie Jos)**.
- Overstap in de praktijk: jos@safetygreen-account aanmaken als beheerder
  bij Safety Green, info@gearonimo daar op inactief; testklanten uitnodigen.
- **De oude apps blijven als noodrem beschikbaar** (alleen-lezen).

## Fase 5 — Commercieel en de stores (±3–4 bouwsessies)

> **Herzien 2026-07-19 (besluit Jos):** de app blijft voorlopig (±het
> eerste jaar) **gratis voor iedereen** en is **op uitnodiging** tijdens
> een uitgebreide testfase. Stripe schuift daarmee naar achteren; de
> En-GB-vertaling + het activeren van het VK-regime worden juist naar
> voren gehaald als eerstvolgende fase-5-werk.

- Stripe: abonnement per keurmeester + metered tikken met staffel
  (blauwdruk §7) — **uitgesteld, zie hierboven**.
- Capacitor-builds; store-registraties (App Store / Play Store) voor beide
  apps; marketing-/aanmeldsite op gearcert.com.
- En-GB vertaling afronden + VK-regime activeren; kwalificatie-uploads
  zichtbaar voor klanten.
- **Mijlpaal: lancering** — eerst NL, daarna VK.

## Daarna (bewust buiten het plan)

- Duitsland (DE-vertaling + elektronisch zegel op PDF), VS.
- CSV-import met fuzzy-matching voor nieuwe keurbedrijven (zie BLAUWDRUK §9).
- Keuringsplanner als optionele module.
- B2B-rapportages, NEN 3140-meetwaarden.

## Ritme en doorlooptijd

Totaal ±13–18 bouwsessies. Het tempo bepaalt Jos: elke fase eindigt met
testwerk voor hem, en pas na zijn akkoord gaat de volgende fase open. Bij
een ritme van 2–3 sessies per week is fase 2 (schaduwdraaien) binnen een
maand bereikbaar.
