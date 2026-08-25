/**
 * Werklijst voor ontbrekende handleiding-links.
 *
 *   node scripts/catalog/handleidingen.mts            # overzicht per merk
 *   node scripts/catalog/handleidingen.mts --merk=ISC # welke producten precies
 *   node scripts/catalog/handleidingen.mts --excel    # invulbestand per merk
 *
 * Achtergrond (2026-08-25): 1112 van de 2700 producten had geen
 * handleiding-link, en dat groeide stil mee omdat niets het opmerkte. De
 * validatie meldt nu het totaal; dit script laat zien wáár het zit en levert
 * een invulbestand op.
 *
 * De invul-Excel heeft één regel per merk met één kolom `manual_url`. Vul daar
 * de downloadpagina van de fabrikant in en draai:
 *
 *   node scripts/catalog/handleidingen.mts --toepassen=<ingevuld.xlsx>
 *
 * Dan krijgt elk product van dat merk dát nog geen link heeft die pagina.
 * Producten die al een eigen (product-specifieke) link hebben blijven met
 * rust — die is altijd beter dan een merkpagina.
 *
 * ⚠ Een merkpagina is nadrukkelijk de snelle route, niet de nette. De nette is
 * een eigen PDF per product (zoals de ISC-UIM's en de Petzl-downloadlinks die
 * er al in staan). Dit is bedoeld om van "niets" naar "iets bruikbaars" te
 * komen voor honderden producten tegelijk.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import * as XLSX from "xlsx";
import {
  readSource,
  writeSource,
  readAnyFile,
  EXPORT_DIR,
  REPO_ROOT,
} from "./lib/bronlijst.mts";

const merkFilter = process.argv
  .find((a) => a.startsWith("--merk="))
  ?.slice(7)
  .trim()
  .toLowerCase();
const excel = process.argv.includes("--excel");
const toepassen = process.argv.find((a) => a.startsWith("--toepassen="))?.slice(12);

const alle = readSource();

if (toepassen) {
  // Ingevuld bestand: merk → link. Lege regels overslaan, zodat je in twee
  // rondes kunt werken zonder de eerste ronde ongedaan te maken.
  const links = new Map<string, string>();
  for (const rij of readAnyFile(toepassen)) {
    const merk = (rij.brand ?? "").trim().toLowerCase();
    const url = (rij.manual_url ?? "").trim();
    if (merk && url) links.set(merk, url);
  }
  if (links.size === 0) {
    console.log("\nGeen ingevulde links gevonden in dat bestand.\n");
    process.exit(0);
  }

  let gevuld = 0;
  const perMerk = new Map<string, number>();
  for (const r of alle) {
    if (r.manual_url.trim()) continue;
    const url = links.get(r.brand.trim().toLowerCase());
    if (!url) continue;
    r.manual_url = url;
    gevuld++;
    perMerk.set(r.brand, (perMerk.get(r.brand) ?? 0) + 1);
  }
  writeSource(alle);
  console.log(`\n${gevuld} producten kregen een handleiding-link:`);
  for (const [merk, n] of [...perMerk].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${merk}: ${n}`);
  }
  console.log("\nControleer met: git diff catalog/\n");
  process.exit(0);
}

const zonder = alle.filter((r) => !r.manual_url.trim());
const perMerk = new Map<string, { mist: number; totaal: number }>();
for (const r of alle) {
  const merk = r.brand.trim() || "(geen merk)";
  const e = perMerk.get(merk) ?? { mist: 0, totaal: 0 };
  e.totaal++;
  if (!r.manual_url.trim()) e.mist++;
  perMerk.set(merk, e);
}

if (merkFilter) {
  const hits = zonder.filter((r) => r.brand.trim().toLowerCase() === merkFilter);
  console.log(`\n${hits.length} producten van "${merkFilter}" zonder handleiding-link:\n`);
  for (const r of hits) {
    const code = r.manufacturer_code ? ` [${r.manufacturer_code}]` : "";
    console.log(`  ${r.name}${code}`);
  }
  console.log("");
  process.exit(0);
}

const rijen = [...perMerk]
  .filter(([, e]) => e.mist > 0)
  .sort((a, b) => b[1].mist - a[1].mist)
  .map(([merk, e]) => ({
    brand: merk,
    zonder_handleiding: e.mist,
    producten_totaal: e.totaal,
    manual_url: "",
  }));

console.log(
  `\n${zonder.length} van ${alle.length} producten zonder handleiding-link, over ${rijen.length} merken:\n`
);
console.log(`  ${"merk".padEnd(24)}${"mist".padStart(6)}${"totaal".padStart(8)}`);
for (const r of rijen) {
  console.log(
    `  ${r.brand.slice(0, 22).padEnd(24)}${String(r.zonder_handleiding).padStart(6)}${String(r.producten_totaal).padStart(8)}`
  );
}

if (excel) {
  const sheet = XLSX.utils.json_to_sheet(rijen, {
    header: ["brand", "zonder_handleiding", "producten_totaal", "manual_url"],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Handleidingen");
  mkdirSync(EXPORT_DIR, { recursive: true });
  const file = resolve(
    EXPORT_DIR,
    `handleidingen-per-merk-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
  writeFileSync(file, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\n${relative(REPO_ROOT, file)}`);
  console.log("  Vul de kolom manual_url per merk en draai daarna:");
  console.log("  node scripts/catalog/handleidingen.mts --toepassen=<bestand>");
}
console.log("");
