/**
 * Zet de eigenaardigheden van een geschraapt bestand om naar de afspraken.
 *
 *   node scripts/catalog/normaliseer.mts bestand.csv [--uit=doel.csv]
 *
 * De aangeleverde lijsten komen uit een scrape-pijplijn en hebben steeds
 * dezelfde systematische afwijkingen. Die hier omzetten in plaats van met de
 * hand, want met de hand is precies waar het eerder misging.
 *
 * Wat er omgaat:
 *
 * 1. `UNL` → `999` in de levensduurvelden. Besluit Jos 2026-07-28: leeg leest
 *    als "nog opzoeken", 999 als "bewust geen leeftijdsgrens".
 * 2. `no ppe` → `no_ppe`. Zelfde waarde, andere schrijfwijze.
 *
 * Wat er bewust NIET automatisch omgaat: een artikelomschrijving die in
 * `product_type` staat, maatvarianten die alleen in `manufacturer_code`
 * verschillen, en tegenstrijdige gegevens tussen twee bestanden. Die worden
 * gemeld, want daar hoort een mens naar te kijken.
 */

import { writeFileSync } from "node:fs";
import { objectsToCsv } from "./lib/csv.mts";
import {
  CATALOG_COLUMNS,
  PRODUCT_TYPES,
  productKey,
  type CatalogRow,
} from "../../packages/core/src/catalog.ts";
import { readAnyFile, toCatalogRow } from "./lib/bronlijst.mts";

/**
 * Alleen schrijfwijze rechttrekken, geen betekenis raden.
 *
 * Een eerdere versie hiervan had een tabel die artikelomschrijvingen
 * ("Swivel", "Friction Saver", "Hitch Cord") zelf naar een regime vertaalde.
 * Vergeleken met de live catalogus week die tabel op 85 van de 296 rijen af:
 * Jos had die producten allang zelf geclassificeerd, en beter. Zulke waarden
 * worden daarom gemeld in plaats van geraden — de keuze tussen `ppe`,
 * `rigging` en `no_ppe` is vakwerk, en bij `no_ppe` verandert de keurtermijn
 * ook echt (die valt terug op 12 maanden, terwijl PBM in GB op 6 moet).
 */
function normaliseerType(value: string): (typeof PRODUCT_TYPES)[number] | null {
  const direct = value.trim().toLowerCase().replace(/\s+/g, "_");
  return (PRODUCT_TYPES as readonly string[]).includes(direct)
    ? (direct as (typeof PRODUCT_TYPES)[number])
    : null;
}

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
if (!source) {
  console.error("Geef een bestand mee.");
  process.exit(1);
}
const outArg = args.find((a) => a.startsWith("--uit="))?.slice(6);
const target = outArg ?? source.replace(/\.(csv|xlsx|xls)$/i, "") + "-genormaliseerd.csv";

const rows: CatalogRow[] = readAnyFile(source).map(toCatalogRow);

let unlFixed = 0;
let typeFixed = 0;
const unmapped = new Map<string, number>();

for (const row of rows) {
  // 1. UNL → 999
  for (const field of ["max_age_use_years", "max_age_mfr_years"] as const) {
    if (/^unl$/i.test(row[field].trim())) {
      row[field] = "999";
      unlFixed++;
    }
  }

  // 2. product_type: alleen de schrijfwijze
  const original = row.product_type.trim();
  if (original && !(PRODUCT_TYPES as readonly string[]).includes(original)) {
    const mapped = normaliseerType(original);
    if (mapped) {
      row.product_type = mapped;
      typeFixed++;
    } else {
      unmapped.set(original, (unmapped.get(original) ?? 0) + 1);
    }
  }
}

// Maatvarianten melden, niet zelf oplossen: welke maat bij welke code hoort
// staat in de documentatie van de fabrikant, niet in dit bestand.
const groups = new Map<string, CatalogRow[]>();
for (const row of rows) {
  if (!row.brand || !row.name) continue;
  const key = productKey(row.brand, row.name);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(row);
}
const duplicates = [...groups.values()].filter((g) => g.length > 1);

console.log(`\n${source}`);
console.log(`  ${rows.length} rijen gelezen`);
console.log(`  ${unlFixed}× UNL → 999`);
console.log(`  ${typeFixed}× product_type-schrijfwijze rechtgetrokken`);

if (unmapped.size > 0) {
  const total = [...unmapped.values()].reduce((a, b) => a + b, 0);
  console.log(`\n  ${total} rijen met een product_type die niet te herleiden is:`);
  for (const [value, count] of [...unmapped].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${count}×  ${JSON.stringify(value)}`);
  }
}

if (duplicates.length > 0) {
  console.log(`\n  ${duplicates.length} keer dezelfde merk + omschrijving:`);
  for (const group of duplicates) {
    const differing = CATALOG_COLUMNS.filter(
      (c) => new Set(group.map((g) => g[c])).size > 1
    );
    console.log(
      `    ${group[0].brand} ${group[0].name} (${group.length}×) — verschilt in: ${differing.join(", ") || "niets"}`
    );
  }
}

writeFileSync(target, objectsToCsv(rows, CATALOG_COLUMNS));
console.log(`\n  geschreven: ${target}\n`);
