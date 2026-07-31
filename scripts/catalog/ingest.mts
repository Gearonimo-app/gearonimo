/**
 * Voeg aangeleverde bestanden toe aan de bronlijst.
 *
 *   node scripts/catalog/ingest.mts                    # alles in catalog/inbox/
 *   node scripts/catalog/ingest.mts lijst.xlsx         # één bestand
 *   node scripts/catalog/ingest.mts --dry-run          # alleen tonen
 *   node scripts/catalog/ingest.mts --overwrite        # lege cellen wissen wél
 *
 * Standaard wist een lege cel niets — zie `mergeRows`. Dat is de belangrijkste
 * bescherming tegen het stil weglekken van al ingevulde velden.
 */

import { readdirSync, existsSync } from "node:fs";
import { resolve, relative, basename } from "node:path";
import { validateCatalog } from "../../packages/core/src/catalog.ts";
import {
  readSource,
  writeSource,
  readAnyFile,
  toCatalogRow,
  unknownColumns,
  mergeRows,
  INBOX_DIR,
  REPO_ROOT,
  type RowChange,
} from "./lib/bronlijst.mts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const overwrite = args.includes("--overwrite");
const files = args.filter((a) => !a.startsWith("--"));

/** Zonder bestandsnaam: alles uit de inbox, op naam gesorteerd. */
function inboxFiles(): string[] {
  if (!existsSync(INBOX_DIR)) return [];
  return readdirSync(INBOX_DIR)
    .filter((f) => /\.(xlsx|xls|csv)$/i.test(f) && !f.startsWith("~$"))
    .sort()
    .map((f) => resolve(INBOX_DIR, f));
}

const targets = files.length > 0 ? files.map((f) => resolve(f)) : inboxFiles();

if (targets.length === 0) {
  console.log(
    `\nGeen bestanden gevonden in ${relative(REPO_ROOT, INBOX_DIR)}/.\n` +
      `Zet daar de Excel- of CSV-bestanden neer, of geef een pad mee.\n`
  );
  process.exit(0);
}

let rows = readSource();
const startCount = rows.length;
console.log(`\nBronlijst nu: ${startCount} producten`);

const allAdded: string[] = [];
const allUpdated: RowChange[] = [];
const allKeptBlank: RowChange[] = [];

for (const file of targets) {
  const raw = readAnyFile(file);
  const unknown = raw.length > 0 ? unknownColumns(raw[0]) : [];
  const incoming = raw.map(toCatalogRow);

  console.log(`\n${basename(file)}: ${incoming.length} rijen`);
  if (unknown.length > 0) {
    console.log(`  niet overgenomen kolommen: ${unknown.join(", ")}`);
  }

  const result = mergeRows(rows, incoming, { overwrite });
  rows = result.rows;

  console.log(
    `  ${result.added.length} nieuw, ${result.updated.length} bijgewerkt, ${result.unchanged} ongewijzigd`
  );
  if (result.keptBlank.length > 0) {
    console.log(
      `  ${result.keptBlank.length} rijen hadden lege cellen waar de bronlijst wél een waarde heeft — behouden`
    );
  }

  allAdded.push(...result.added);
  allUpdated.push(...result.updated);
  allKeptBlank.push(...result.keptBlank);
}

// --- Wat er precies verandert, zodat het in de commit kan --------------------

function show(title: string, items: string[], max = 25) {
  if (items.length === 0) return;
  console.log(`\n${title} (${items.length}):`);
  for (const item of items.slice(0, max)) console.log(`  ${item}`);
  if (items.length > max) console.log(`  … en nog ${items.length - max}`);
}

show("Nieuw", allAdded);
show(
  "Bijgewerkt",
  allUpdated.map(
    (u) =>
      `${u.product} — ${u.fields
        .map((f) => `${f.column}: ${f.from || "(leeg)"} → ${f.to}`)
        .join(", ")}`
  )
);
show(
  "Lege cellen genegeerd (bestaande waarde behouden)",
  allKeptBlank.map(
    (u) => `${u.product} — ${u.fields.map((f) => f.column).join(", ")}`
  ),
  10
);

// --- Controleren vóór wegschrijven ------------------------------------------

const report = validateCatalog(rows);
console.log(
  `\nResultaat: ${rows.length} producten (${rows.length - startCount} erbij)`
);

if (report.errors.length > 0) {
  console.log(`\nFouten (${report.errors.length}) — niet weggeschreven:`);
  for (const issue of report.errors.slice(0, 25)) {
    const col = issue.column ? ` [${issue.column}]` : "";
    console.log(`  regel ${issue.line}${col} — ${issue.product}: ${issue.message}`);
  }
  if (report.errors.length > 25) {
    console.log(`  … en nog ${report.errors.length - 25}`);
  }
  console.log(
    `\nDe bronlijst is niet aangepast. Herstel de fouten in het aangeleverde bestand en probeer opnieuw.\n`
  );
  process.exit(1);
}

if (report.warnings.length > 0) {
  console.log(`\n${report.warnings.length} aandachtspunten — zie validate.mts`);
}

if (dryRun) {
  console.log(`\n--dry-run: bronlijst niet aangepast.\n`);
  process.exit(0);
}

writeSource(rows);
console.log(`\nBronlijst bijgewerkt. Controleer met 'git diff catalog/'.\n`);
