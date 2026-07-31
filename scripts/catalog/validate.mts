/**
 * Controleer de bronlijst.
 *
 *   node scripts/catalog/validate.mts [bestand]
 *
 * Zonder argument controleert hij `catalog/producten.csv`. Met een argument
 * kun je een aangeleverd bestand nakijken vóór je het invoegt.
 *
 * Sluit af met code 1 als er blokkerende fouten zijn, zodat dit ook in een
 * controle vooraf gebruikt kan worden.
 */

import { validateCatalog } from "../../packages/core/src/catalog.ts";
import {
  readSource,
  readAnyFile,
  toCatalogRow,
  unknownColumns,
  SOURCE_FILE,
} from "./lib/bronlijst.mts";
import { relative } from "node:path";
import { REPO_ROOT } from "./lib/bronlijst.mts";

const arg = process.argv[2];
const rows = arg ? readAnyFile(arg).map(toCatalogRow) : readSource();
const label = arg ? arg : relative(REPO_ROOT, SOURCE_FILE);

// Onbekende kolommen apart melden: dat is meestal een typefout in een kopregel
// of een kolom uit een oude export (zoals inspection_interval_years, die
// bewust niet meer wordt overgenomen). Zonder melding verdwijnt zo'n kolom
// geruisloos.
if (arg) {
  const raw = readAnyFile(arg);
  const unknown = raw.length > 0 ? unknownColumns(raw[0]) : [];
  if (unknown.length > 0) {
    console.log(
      `\nKolommen die de catalogus niet kent (worden niet overgenomen):\n  ${unknown.join(", ")}`
    );
  }
}

const report = validateCatalog(rows);

console.log(`\n${label}: ${report.rowCount} producten`);
console.log(
  `  ${report.withoutId} zonder id (worden toegevoegd), ${report.withId} met id (worden bijgewerkt)`
);

if (report.errors.length > 0) {
  console.log(`\nFouten (${report.errors.length}) — deze blokkeren de import:`);
  for (const issue of report.errors) {
    const col = issue.column ? ` [${issue.column}]` : "";
    console.log(`  regel ${issue.line}${col} — ${issue.product}: ${issue.message}`);
  }
}

if (report.warnings.length > 0) {
  console.log(`\nAandachtspunten (${report.warnings.length}):`);
  // Bij een grote lijst is een muur van waarschuwingen onleesbaar; groeperen
  // per soort geeft sneller inzicht in wat er structureel mis is.
  const byKind = new Map<string, number>();
  for (const issue of report.warnings) {
    const kind = issue.column ?? "algemeen";
    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
  }
  for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}× ${kind}`);
  }
  const shown = report.warnings.slice(0, 10);
  for (const issue of shown) {
    console.log(`    regel ${issue.line} — ${issue.product}: ${issue.message}`);
  }
  if (report.warnings.length > shown.length) {
    console.log(`    … en nog ${report.warnings.length - shown.length}`);
  }
}

if (report.errors.length === 0 && report.warnings.length === 0) {
  console.log("\nGeen fouten en geen aandachtspunten.");
}

console.log("");
process.exit(report.errors.length > 0 ? 1 : 0);
