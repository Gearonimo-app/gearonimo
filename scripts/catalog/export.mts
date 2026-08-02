/**
 * Schrijf de bronlijst weg als Excel voor de import in Gearonimo.
 *
 *   node scripts/catalog/export.mts                 # hele bronlijst
 *   node scripts/catalog/export.mts --new-only      # alleen de nieuwe producten
 *   node scripts/catalog/export.mts --merk=Tractel  # alleen dat merk
 *   node scripts/catalog/export.mts --ids=a,b,c     # precies deze producten
 *   node scripts/catalog/export.mts --sinds=<export.xlsx>
 *                                                   # alles wat Gearonimo nog
 *                                                   # niet heeft, in één bestand
 *
 * `--merk` is er omdat de import elke rij mét id apart bijwerkt, één verzoek
 * per rij. De hele lijst terugsturen voor tien gewijzigde producten betekent
 * dus ruim 2300 overbodige verzoeken; met een merkfilter blijft het bij wat
 * er echt veranderd is.
 *
 * Zelfde bibliotheek, zelfde kolommen en zelfde bladnaam als de export in de
 * app, zodat dit bestand gegarandeerd door de importwizard komt.
 *
 * ⚠ Exporteer altijd hiermee, en stuur nooit een besluit- of deelbestand naar
 * de importwizard. Bij een rij mét id bouwt die wizard een volledige rij op uit
 * het bestand en schrijft die met `update` weg — kolommen die in het bestand
 * ontbreken worden dus leeg in de database. De "lege cel wist niets"-regel geldt
 * alleen hier in de repo, niet in de app.
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
import {
  readSource,
  readAnyFile,
  toCatalogRow,
  EXPORT_DIR,
  REPO_ROOT,
} from "./lib/bronlijst.mts";

const newOnly = process.argv.includes("--new-only");
const brand = process.argv
  .find((a) => a.startsWith("--merk="))
  ?.slice(7)
  .trim()
  .toLowerCase();

// `--ids=` voor "precies deze producten heb ik aangepast". Een merkfilter is
// dan te grof: drie gewijzigde producten van drie merken zou anders honderden
// overbodige bijwerkingen betekenen.
const ids = process.argv
  .find((a) => a.startsWith("--ids="))
  ?.slice(6)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// `--sinds=<export.xlsx>`: alles wat Gearonimo nog niet heeft, gemeten tegen
// een eerdere export uit de app. Levert één bestand dat in één keer toevoegt
// én bijwerkt, zodat er geen losse bestanden in de juiste volgorde gedraaid
// hoeven te worden -- daar zit de kans op fouten, niet in de import zelf.
const sinds = process.argv.find((a) => a.startsWith("--sinds="))?.slice(8);

const all = readSource();
let rows = newOnly ? all.filter((r) => !r.id) : all;

if (sinds) {
  const eerder = new Map(
    readAnyFile(sinds).map(toCatalogRow).map((r) => [r.id, r])
  );
  rows = rows.filter((row) => {
    if (!row.id) return true; // nieuw product
    const was = eerder.get(row.id);
    if (!was) return true; // stond niet in die export
    return CATALOG_COLUMNS.some((c) => row[c].trim() !== was[c].trim());
  });
}
if (brand) rows = rows.filter((r) => r.brand.trim().toLowerCase() === brand);
if (ids) {
  const wanted = new Set(ids);
  rows = rows.filter((r) => wanted.has(r.id));
  const missing = ids.filter((id) => !rows.some((r) => r.id === id));
  if (missing.length > 0) {
    console.log(`\nNiet gevonden in de bronlijst: ${missing.join(", ")}`);
  }
}

if (rows.length === 0) {
  // `--sinds` levert normaal gesproken nul rijen zodra alles geïmporteerd is;
  // dat is de gewenste uitkomst en geen lege bronlijst. Die twee door elkaar
  // halen leest als een fout terwijl er juist niets meer te doen is.
  console.log(
    sinds
      ? `\nNiets openstaand: de bronlijst (${all.length} producten) en die export lopen gelijk.\n`
      : brand
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
  `gearonimo-catalogus-${date}${newOnly ? "-nieuw" : ""}${brand ? `-${brand.replace(/\W+/g, "-")}` : ""}${ids ? "-selectie" : ""}${sinds ? "-alles-openstaand" : ""}.xlsx`
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
