/**
 * Schrijf de bronlijst weg als Excel voor de import in Gearonimo.
 *
 *   node scripts/catalog/export.mts                 # hele bronlijst
 *   node scripts/catalog/export.mts --new-only      # alleen de nieuwe producten
 *   node scripts/catalog/export.mts --merk=Tractel  # alleen dat merk
 *
 * `--merk` is er omdat de import elke rij mét id apart bijwerkt, één verzoek
 * per rij. De hele lijst terugsturen voor tien gewijzigde producten betekent
 * dus ruim 2300 overbodige verzoeken; met een merkfilter blijft het bij wat
 * er echt veranderd is.
 *
 * Zelfde bibliotheek, zelfde kolommen en zelfde bladnaam als de export in de
 * app, zodat dit bestand gegarandeerd door de importwizard komt.
 *
 * Hoe de import het leest (`CatalogManager.vue`):
 *   - rij mét id  → dat product wordt bijgewerkt
 *   - rij zonder id → nieuw product, tenzij merk + omschrijving al bestaan;
 *     dan wordt de rij overgeslagen als duplicaat
 *
 * `--new-only` levert dus het kleinste bestand dat alleen toevoegt. Dat is de
 * veiligste keuze zolang er niets bijgewerkt hoeft te worden: wat al in
 * Gearonimo staat wordt niet aangeraakt.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import * as XLSX from "xlsx";
import {
  CATALOG_COLUMNS,
  validateCatalog,
} from "../../packages/core/src/catalog.ts";
import { readSource, EXPORT_DIR, REPO_ROOT } from "./lib/bronlijst.mts";

const newOnly = process.argv.includes("--new-only");
const brand = process.argv
  .find((a) => a.startsWith("--merk="))
  ?.slice(7)
  .trim()
  .toLowerCase();

const all = readSource();
let rows = newOnly ? all.filter((r) => !r.id) : all;
if (brand) rows = rows.filter((r) => r.brand.trim().toLowerCase() === brand);

if (rows.length === 0) {
  console.log(
    brand
      ? `\nGeen producten van merk "${brand}"${newOnly ? " zonder id" : ""}.\n`
      : newOnly
        ? "\nGeen producten zonder id — er is niets nieuws om te importeren.\n"
        : "\nDe bronlijst is leeg.\n"
  );
  process.exit(0);
}

// Nooit een lijst met fouten aan Jos geven: die klapt of importeert stil
// verkeerde waarden.
const report = validateCatalog(rows);
if (report.errors.length > 0) {
  console.log(`\n${report.errors.length} fouten in de bronlijst — geen export.`);
  for (const issue of report.errors.slice(0, 25)) {
    const col = issue.column ? ` [${issue.column}]` : "";
    console.log(`  regel ${issue.line}${col} — ${issue.product}: ${issue.message}`);
  }
  console.log("\nControleer met: node scripts/catalog/validate.mts\n");
  process.exit(1);
}

const sheet = XLSX.utils.json_to_sheet(rows, { header: [...CATALOG_COLUMNS] });
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheet, "Catalogus");

mkdirSync(EXPORT_DIR, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const file = resolve(
  EXPORT_DIR,
  `gearonimo-catalogus-${date}${newOnly ? "-nieuw" : ""}${brand ? `-${brand.replace(/\W+/g, "-")}` : ""}.xlsx`
);
writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

const withId = rows.filter((r) => r.id).length;
console.log(`\n${relative(REPO_ROOT, file)}`);
console.log(`  ${rows.length} producten`);
console.log(`  ${rows.length - withId} zonder id → worden toegevoegd`);
if (withId > 0) {
  console.log(`  ${withId} met id → worden bijgewerkt`);
  console.log(
    `\n  Let op: de import weigert een id die niet meer in de catalogus staat.\n` +
      `  Is de catalogus tussentijds leeggemaakt, exporteer dan met --new-only.`
  );
}
console.log("");
