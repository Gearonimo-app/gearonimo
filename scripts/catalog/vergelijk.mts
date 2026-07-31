/**
 * Vergelijk een aangeleverd bestand met de bronlijst, zonder iets te wijzigen.
 *
 *   node scripts/catalog/vergelijk.mts bestand.xlsx [bestand2.csv ...]
 *
 * Beantwoordt de vraag "zit dit er al in?" vóór er iets ingevoegd wordt:
 * wat is nieuw, wat staat er al, wat vult lege velden aan, en waar spreken
 * bestand en bronlijst elkaar tegen.
 *
 * Dat laatste is het belangrijkst. Nieuw en aanvullend zijn onschuldig; een
 * tegenstrijdigheid betekent dat één van de twee bronnen fout is, en dat is
 * niets voor een script om te beslissen. Zo kwam het verschil in
 * Tractel-levensduur boven water (bronlijst 20 jaar, bestand 999 = onbeperkt)
 * — Jos hakte de knoop door, niet de import.
 */

import { basename } from "node:path";
import {
  CATALOG_COLUMNS,
  productKey,
  validateCatalog,
  type CatalogColumn,
} from "../../packages/core/src/catalog.ts";
import {
  readSource,
  readAnyFile,
  toCatalogRow,
  unknownColumns,
} from "./lib/bronlijst.mts";

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  console.error("Geef één of meer bestanden mee.");
  process.exit(1);
}

const source = readSource();
const byKey = new Map(
  source.filter((r) => r.brand && r.name).map((r) => [productKey(r.brand, r.name), r])
);
const byId = new Map(source.filter((r) => r.id).map((r) => [r.id, r]));

console.log(`\nBronlijst: ${source.length} producten\n`);

for (const file of files) {
  const raw = readAnyFile(file);
  const rows = raw.map(toCatalogRow);
  const unknown = raw.length > 0 ? unknownColumns(raw[0]) : [];

  const isNew: typeof rows = [];
  let identical = 0;
  const fills = new Map<CatalogColumn, number>();
  const clashes = new Map<CatalogColumn, string[]>();

  for (const row of rows) {
    const existing =
      (row.id ? byId.get(row.id) : undefined) ??
      (row.brand && row.name ? byKey.get(productKey(row.brand, row.name)) : undefined);

    if (!existing) {
      isNew.push(row);
      continue;
    }

    let differs = false;
    for (const col of CATALOG_COLUMNS) {
      if (col === "id") continue;
      const incoming = row[col].trim();
      const current = existing[col].trim();
      if (!incoming || incoming === current) continue;
      differs = true;
      if (!current) {
        fills.set(col, (fills.get(col) ?? 0) + 1);
      } else {
        const list = clashes.get(col) ?? [];
        list.push(
          `${existing.brand} ${existing.name}\n        bronlijst: ${JSON.stringify(current)}\n        bestand:   ${JSON.stringify(incoming)}`
        );
        clashes.set(col, list);
      }
    }
    if (!differs) identical++;
  }

  console.log(`${basename(file)} — ${rows.length} rijen`);
  if (unknown.length > 0) {
    console.log(`  kolommen die niet worden overgenomen: ${unknown.join(", ")}`);
  }

  const report = validateCatalog(rows);
  if (report.errors.length > 0) {
    console.log(`  ${report.errors.length} fouten — invoegen wordt geweigerd:`);
    for (const issue of report.errors.slice(0, 10)) {
      const col = issue.column ? ` [${issue.column}]` : "";
      console.log(`    regel ${issue.line}${col} — ${issue.product}: ${issue.message}`);
    }
    if (report.errors.length > 10) {
      console.log(`    … en nog ${report.errors.length - 10}`);
    }
  }

  console.log(`\n  NIEUW:        ${isNew.length}`);
  if (isNew.length > 0) {
    const brands = new Map<string, number>();
    for (const row of isNew) brands.set(row.brand, (brands.get(row.brand) ?? 0) + 1);
    console.log(
      `    ${[...brands]
        .sort((a, b) => b[1] - a[1])
        .map(([b, n]) => `${b} (${n})`)
        .join(", ")}`
    );
    for (const row of isNew.slice(0, 10)) console.log(`    · ${row.brand} ${row.name}`);
    if (isNew.length > 10) console.log(`    … en nog ${isNew.length - 10}`);
  }

  console.log(`  STAAT ER AL:  ${rows.length - isNew.length}, waarvan ${identical} volledig gelijk`);

  if (fills.size > 0) {
    const total = [...fills.values()].reduce((a, b) => a + b, 0);
    console.log(`\n  VULT LEGE VELDEN AAN: ${total}`);
    for (const [col, n] of [...fills].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${n}×  ${col}`);
    }
  }

  if (clashes.size > 0) {
    const total = [...clashes.values()].reduce((a, b) => a + b.length, 0);
    console.log(`\n  TEGENSTRIJDIG: ${total} — hier hoort een besluit bij`);
    for (const [col, examples] of [...clashes].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`    ${examples.length}×  ${col}`);
      for (const example of examples.slice(0, 3)) console.log(`      · ${example}`);
      if (examples.length > 3) console.log(`      … en nog ${examples.length - 3}`);
    }
  }

  if (isNew.length === 0 && fills.size === 0 && clashes.size === 0) {
    console.log(`\n  Dit bestand voegt niets toe — alles staat er al zo in.`);
  }
  console.log("");
}
