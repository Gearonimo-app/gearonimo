# De bronlijst van de catalogus

Hier staat de catalogus die in Gearonimo terechtkomt. **`producten.csv` is de
bron** — niet een Excel op de zaak, niet een bestand in een chatgesprek, niet
de database. Als er twijfel is over wat de laatste versie is, is het antwoord
dit bestand.

Aanleiding (Jos, 2026-07-31): *"ik merk dat veel data verloren gaat in slechte
administratie aan mijn kant. ik heb nu vele bestanden en ben het overzicht
kwijt."*

## Waarom een CSV en geen Excel

Een CSV is regel voor regel te vergelijken. `git log` en `git diff` laten
daardoor zien wélk product wanneer veranderde en waarom — dat is precies het
overzicht dat kwijtraakte. Een `.xlsx` is een zipbestand; git ziet daar alleen
"bestand gewijzigd" en het overzicht is meteen weer weg.

Excel blijft in gebruik aan de uiteinden: aanleveren mag in Excel, en wat naar
Gearonimo gaat is weer een Excel. Alleen de bewaarvorm ertussenin is CSV.

## De werkwijze

```
  jij levert aan            hier in de repo              jij importeert
  ──────────────            ───────────────              ──────────────
  Excel of CSV    ──────►   catalog/inbox/     ──────►   catalog/export/
   (los bestand)            producten.csv                   *.xlsx
                            (de bron, in git)
```

1. **Aanleveren.** Zet het bestand in `catalog/inbox/` — Excel of CSV, hele
   lijst of een paar rijen, komma's of puntkomma's. Die bestanden blijven
   bewaard in git: nooit meer een lijst die zoek is.
2. **Eerst kijken.** `npm run catalog:vergelijk -- bestand.xlsx` verandert
   niets en beantwoordt de vraag "zit dit er al in?": wat is nieuw, wat staat
   er al, wat vult lege velden aan, en waar spreken bestand en bronlijst
   elkaar tegen. Dat laatste is het belangrijkst — een tegenstrijdigheid
   betekent dat één van de twee fout is, en dat is niets voor een script om
   te beslissen.
3. **Invoegen.** `npm run catalog:ingest` leest alles uit de inbox en voegt het
   samen met de bronlijst. Het rapport vertelt wat er nieuw is, wat er
   veranderde (met oude → nieuwe waarde) en wat er is overgeslagen.
4. **Controleren.** `npm run catalog:check` kijkt de hele bronlijst na.
5. **Terugleveren.** `npm run catalog:export` maakt de Excel voor de
   importwizard in Gearonimo (Instellingen → Catalogus → Importeren).

## De regel die data redt: een lege cel wist niets

Lever je een lijst aan met alleen merk, naam en een handleiding-link, dan
blijven de breuksterkte en levensduur die al in de bronlijst stonden gewoon
staan. Alleen ingevulde cellen tellen.

Dit is met opzet zo, en het is de belangrijkste bescherming in de hele opzet:
zonder die regel veegt elk gedeeltelijk lijstje stilletjes de rest van de
catalogus leeg. Het rapport meldt wél hoe vaak dit gebeurde, zodat het geen
verrassing is.

Wil je een waarde juist weghálen, dan kan dat expliciet:

```bash
node scripts/catalog/ingest.mts bestand.xlsx --overwrite
```

## Wat de controle tegenhoudt

Elke regel hieronder staat er omdat het een keer echt misging.

| Wat | Waarom het erin staat |
|---|---|
| Dubbel merk + omschrijving | De catalogus stond op 5699 producten in plaats van 2294, vrijwel alles in dubbele paren (2026-07-28). Zelfde regel als de unieke index in migratie 20260749. |
| Een categorie in `product_type` | Bij 156 van de 2294 rijen stond hier "Locking Carabiner (Screw-Lock)" en dergelijke. `getRegime()` herkent dat niet en valt terug op 12 maanden — in NL toevallig goed, maar **GB moet voor PBM op 6**. Stil gevaarlijk. |
| Tekst in een getalveld | De import maakt daar zonder melding `null` van. Zo lekt ingevulde data weg. |
| Merk of omschrijving leeg | Dan is er geen product en geen sleutel om op te herkennen. |
| Onbekende kolommen | Worden gemeld in plaats van geruisloos genegeerd (zoals `inspection_interval_years`, dat bewust niet meer wordt overgenomen). |

Ruim gelaten waar het hoort: `max_user_weight_kg` mag tekst zijn
(`130-150`, `100 (bij EN 12841/B, 10.5-13mm touw)` — besluit 2026-07-27), en
`999` in een levensduurveld betekent bewust onbeperkt (besluit 2026-07-28).

## Toevoegen of bijwerken: de kolom `id`

De importwizard kijkt naar `id`:

- **`id` leeg** → nieuw product. Bestaat merk + omschrijving al in Gearonimo,
  dan slaat de wizard de rij over als duplicaat.
- **`id` gevuld** → dát product wordt bijgewerkt.

Een `id` komt uit de database, dus die heb je alleen voor producten die al in
Gearonimo staan (via een export uit de app). Voor puur toevoegen is
`npm run catalog:export -- --new-only` het veiligste: die levert alleen de
rijen zonder `id`, en raakt dus niets aan wat er al staat. Voor het bijwerken
van één merk: `npm run catalog:export -- --merk=Tractel`.

> Let op: de import weigert een `id` die niet meer in de catalogus voorkomt.
> Is de catalogus tussentijds leeggemaakt, gebruik dan `--new-only`.

## De velden zelf

`DATAMODEL.md` §2 is de veldenbron. De kolomvolgorde en de toegestane waarden
staan in `packages/core/src/catalog.ts` — die is gedeeld met het
productformulier en met de import/export in de app, zodat er niet drie lijstjes
uit elkaar kunnen lopen.
