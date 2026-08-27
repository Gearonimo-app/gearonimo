/**
 * Zoek winkel- en dealerverwijzingen in de catalogus.
 *
 *   node scripts/catalog/winkels.mts            # overzicht
 *   node scripts/catalog/winkels.mts --lijst    # alle geraakte producten
 *
 * Afspraak met Jos (2026-08-26): *"geen winkels in de app, daar gaan
 * concurrenten over vallen"*. De catalogus wordt gedeeld met keurbedrijven;
 * een link naar één dealer leest als een aanbeveling en dat is niet de rol van
 * dit product.
 *
 * Dit script meldt alleen, het verandert niets. Een dealerlink mag blijven
 * staan zolang de fabrikant zelf niets publiceert — maar dan is het een
 * bewuste keuze en geen toeval. Winkelnamen in de opmerkingen horen er nooit
 * in: die tekst staat tijdens de keuring in beeld.
 */

import { readSource } from "./lib/bronlijst.mts";

/** Hosts van winkels en dealers, geen fabrikanten. */
const WINKELS = [
  "fletcherstewart.com",
  "drayer.de",
  "wesspur.com",
  "sherrilltree.com",
  "safetypro.nl",
  "safetygreen",
  "mybigcommerce.com",
  "beegreen.green",
  "arbsession.com",
  "klettershop",
  "freeworker",
  "seiltechnik-hannover.eu",
  "climbtools.de",
  "vdsteenxxl.com",
  "grube.eu",
  "grube.de",
  "papertrail.io",
  "heyzine.com",
  "c2safety.com",
];

/** Winkelnamen zoals ze in vrije tekst opduiken. */
const NAMEN =
  /fletcher ?stewart|grube|safety ?green|sherrill|wesspur|drayer|freeworker|klettershop|bol\.com|amazon/i;

const rows = readSource();
const lijst = process.argv.includes("--lijst");

const perHost = new Map<string, number>();
const inTekst: string[] = [];
const geraakt = new Set<string>();

for (const r of rows) {
  for (const veld of ["product_page_url", "manual_url"] as const) {
    const u = r[veld].trim().toLowerCase();
    if (!u) continue;
    const hit = WINKELS.find((w) => u.includes(w));
    if (hit) {
      const sleutel = `${veld} — ${hit}`;
      perHost.set(sleutel, (perHost.get(sleutel) ?? 0) + 1);
      geraakt.add(`${r.brand} ${r.name}`);
      if (lijst) console.log(`  [${veld}] ${r.brand} ${r.name} → ${r[veld]}`);
    }
  }
  if (NAMEN.test(r.notes)) inTekst.push(`${r.brand} ${r.name}`);
}

console.log(`\nWinkel- en dealerverwijzingen in ${geraakt.size} van ${rows.length} producten:\n`);
for (const [sleutel, n] of [...perHost].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${sleutel}`);
}

// Winkelnamen in de opmerkingen zijn een hardere fout dan een dealerlink: die
// tekst staat tijdens de keuring op het scherm van de keurmeester.
if (inTekst.length > 0) {
  console.log(`\n⚠ Winkelnaam in de opmerking bij ${inTekst.length} producten:`);
  for (const n of inTekst.slice(0, 20)) console.log(`  ${n}`);
  if (inTekst.length > 20) console.log(`  … en nog ${inTekst.length - 20}`);
} else {
  console.log("\nGeen winkelnamen in de opmerkingen.");
}
console.log("");
