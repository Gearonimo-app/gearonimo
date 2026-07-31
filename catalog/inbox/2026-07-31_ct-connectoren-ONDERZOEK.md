# Climbing Technology — connectoren, onderzoekslijst (NIET ingevoegd)

Status: **niet in de bronlijst opgenomen.** Dit is een vertrekpunt, geen data.

## Waarom niet ingevoegd

De omgeving waarin Claude draait laat geen enkel uitgaand verkeer toe: zowel
`climbingtechnology.com` als `grube.eu`, `petzl.com` en zelfs Wikipedia geven
`403 to CONNECT` op de netwerkpolicy. Alleen de zoekfunctie werkt, en die draait
server-side — die levert zoekresultaten en een samenvatting, geen pagina die te
controleren valt.

De productnamen en URL's hieronder komen rechtstreeks uit zoekresultaten en zijn
daarmee redelijk betrouwbaar. De technische gegevens zijn dat **niet**: de
samenvatting gaf voor Q-Link en Hook It woordelijk dezelfde omschrijving
("hot-forged light-alloy oval carabiner with reduced dimensions, triplex gate en
special anodized hard anti-wear"), terwijl dat twee verschillende producten zijn.
Dat is de samenvatter die tekst hergebruikt, geen echte productdata.

Breuksterkte en EN-norm bepalen wat een keurmeester goedkeurt. Precies dit soort
data leverde eerder de Petzl `M033D`-regel op: een product dat niet bestond, met
23 kN en "EN 12275 H" erbij, dat een hele sessie kostte om te ontdekken. Zulke
rijen aanmaken op basis van zoeksamenvattingen zou dezelfde fout herhalen.

## Hoe dit wél af te maken

1. **Jos levert de bron aan** — de CT-catalogus als PDF, of de technische
   fiches per product. Dan structureer en controleer ik het, net als bij de
   andere merken.
2. **Of de netwerkpolicy gaat open** voor fabrikantensites. Dat is een instelling
   van de omgeving; zie de documentatie bij Claude Code on the web.

Zodra de gegevens er zijn: aanvullen in het CSV ernaast, dan
`npm run catalog:vergelijk` en `catalog:ingest`.
