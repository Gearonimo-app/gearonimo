/**
 * Haal producten uit de bronlijst, op grond van een besluitbestand.
 *
 *   node scripts/catalog/verwijder.mts catalog/inbox/besluit-....csv [--dry-run]
 *
 * Het besluitbestand heeft `brand` en `name` (of `id`), plus een kolom
 * `reden` die in het rapport en de commit terechtkomt. Zo blijft over een
 * half jaar vindbaar waaróm een product verdween — bij een catalogus die
 * gedeeld wordt met keurbedrijven is "hij is weg" zonder reden onbruikbaar.
 *
 * ⚠ Dit haalt het product alleen uit de bronlijst in de repo. **De import in
 * Gearonimo verwijdert nooit iets** — die voegt toe en werkt bij. Een product
 * dat hier weggaat blijft dus in de database staan tot het daar met de knop
 * "Product verwijderen" wordt weggehaald (Catalogus → product → bewerken).
 * Die knop draait `delete_product` (migratie 20260751), die de gekoppelde
 * artikelen in dezelfde transactie ontkoppelt en merk/naam terugzet als vrije
 * tekst. Dat kan een script hier niet, en moet het ook niet stilzwijgend doen.
 */

import { readFileSync } from "node:fs";
import { csvToObjects } from "./lib/csv.mts";
import { productKey } from "../../packages/core/src/catalog.ts";
import { readSource, writeSource } from "./lib/bronlijst.mts";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Geef een besluitbestand mee.");
  process.exit(1);
}

const wanted = csvToObjects(readFileSync(file, "utf8"));
const rows = readSource();
const kept: typeof rows = [];
const removed: { product: string; reden: string }[] = [];
const notFound: string[] = [];

// Eerst opzoeken wat er weg moet, zodat een tikfout in het besluitbestand
// opvalt in plaats van stil niets te doen.
const byKey = new Map<string, string>();
const byId = new Map<string, string>();
for (const w of wanted) {
  const reden = (w.reden ?? "").trim() || "(geen reden opgegeven)";
  if ((w.id ?? "").trim()) byId.set(w.id.trim(), reden);
  else if ((w.brand ?? "").trim() && (w.name ?? "").trim()) {
    byKey.set(productKey(w.brand, w.name), reden);
  }
}

const hitKeys = new Set<string>();
const hitIds = new Set<string>();

for (const row of rows) {
  // Altijd allebei de sleutels proberen, en alleen op `undefined` testen.
  //
  // Twee vallen zitten hier vlak naast elkaar. `row.id && byId.get(row.id) ?? …`
  // levert bij een lege id de lege string op; die is niet nullish, dus `??`
  // schakelt niet door en élk product zonder id gold als "moet weg" — in de
  // dry-run 91 stuks die niets met het besluit te maken hadden. Andersom mag
  // een rij mét id niet stoppen bij de id-zoekopdracht, want een besluitbestand
  // noemt meestal merk + naam en geen id.
  const byIdHit = row.id ? byId.get(row.id) : undefined;
  const byKeyHit =
    row.brand && row.name ? byKey.get(productKey(row.brand, row.name)) : undefined;
  const reden = byIdHit ?? byKeyHit;
  if (reden === undefined) {
    kept.push(row);
    continue;
  }
  if (row.id) hitIds.add(row.id);
  if (row.brand && row.name) hitKeys.add(productKey(row.brand, row.name));
  removed.push({ product: `${row.brand} ${row.name}`, reden });
}

for (const [key, reden] of byKey) {
  if (!hitKeys.has(key)) notFound.push(`${key.replace("\0", " / ")} — ${reden}`);
}
for (const [id, reden] of byId) {
  if (!hitIds.has(id)) notFound.push(`id ${id} — ${reden}`);
}

console.log(`\nBronlijst: ${rows.length} producten`);
console.log(`\nWordt verwijderd (${removed.length}):`);
for (const r of removed) console.log(`  · ${r.product}\n      ${r.reden}`);

if (notFound.length > 0) {
  console.log(`\nNiet gevonden in de bronlijst (${notFound.length}):`);
  for (const n of notFound) console.log(`  · ${n}`);
}

if (removed.length === 0) {
  console.log("\nNiets te doen.\n");
  process.exit(0);
}

if (dryRun) {
  console.log(`\n--dry-run: bronlijst niet aangepast.\n`);
  process.exit(0);
}

writeSource(kept);
console.log(`\nBronlijst: ${kept.length} producten over.`);
console.log(
  `\n⚠ In Gearonimo staan ze nog. De import verwijdert nooit iets — haal ze\n` +
    `  daar weg via Catalogus → product → bewerken → Product verwijderen.\n`
);
