/**
 * Neem de id's over die Gearonimo zelf aan nieuwe producten gaf.
 *
 *   npm run catalog:ids -- catalog/inbox/<export-uit-de-app>.xlsx
 *
 * Een nieuw product (rij zonder `id`) krijgt zijn id pas bij het importeren,
 * van de database. Blijft de bronlijst daarna zonder id, dan ziet de
 * importwizard die rij bij elke volgende import als "nieuw", vindt merk + naam
 * al terug en slaat hem over als duplicaat -- de rij wordt dan nooit meer
 * bijgewerkt (Jos, 2026-09-29: 119 producten, "119 stond er al
 * (overgeslagen)", met maanden-oude opmerkingen in de app).
 *
 * Vult alleen een LEEG id, op merk + naam. Een bestaand id wordt nooit
 * overschreven; daarvoor is `catalog:ingest` met zijn eigen controle.
 */

import { basename } from "node:path";
import { productKey } from "../../packages/core/src/catalog.ts";
import { readSource, readAnyFile, toCatalogRow, writeSource } from "./lib/bronlijst.mts";

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Geef een export uit de app mee (Instellingen → Catalogus → Exporteren).");
  process.exit(1);
}

const source = readSource();
const appByKey = new Map(
  readAnyFile(file)
    .map(toCatalogRow)
    .filter((r) => r.id && r.brand && r.name)
    .map((r) => [productKey(r.brand, r.name), r.id]),
);
const used = new Set(source.filter((r) => r.id).map((r) => r.id));

const filled: string[] = [];
const notFound: string[] = [];
const taken: string[] = [];
for (const row of source) {
  if (row.id) continue;
  const id = appByKey.get(productKey(row.brand, row.name));
  if (!id) notFound.push(`${row.brand} ${row.name}`);
  else if (used.has(id)) taken.push(`${row.brand} ${row.name} (${id})`);
  else {
    row.id = id;
    used.add(id);
    filled.push(`${row.brand} ${row.name}`);
  }
}

console.log(`\n${basename(file)}: ${filled.length} id('s) overgenomen.`);
for (const p of filled.slice(0, 20)) console.log(`  · ${p}`);
if (filled.length > 20) console.log(`  … en nog ${filled.length - 20}`);
if (notFound.length) {
  console.log(`\nNog niet in de app (eerst importeren): ${notFound.length}`);
  for (const p of notFound.slice(0, 20)) console.log(`  · ${p}`);
}
if (taken.length) {
  console.log(`\nid al gebruikt door een ander product in de bronlijst -- handmatig controleren:`);
  for (const p of taken) console.log(`  · ${p}`);
}

if (filled.length) writeSource(source);
console.log("");
