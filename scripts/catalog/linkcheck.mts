/**
 * Controleer of manual_url en product_page_url écht bestaan.
 *
 *   node scripts/catalog/linkcheck.mts               # hele bronlijst
 *   node scripts/catalog/linkcheck.mts --merk=Teufelberger
 *   node scripts/catalog/linkcheck.mts --veld=manual_url
 *
 * Achtergrond (2026-08-29): Jos testte een handleiding-link (Sirius Loop) en
 * kreeg een 404. De link zelf gaf HTTP 200 terug — Teufelberger's site stuurt
 * bij een verwijderde pagina een "soft 404": een gewone 200-pagina die zegt
 * dat er niets is. Een simpele statuscode-check mist dat. Dit script telt
 * alleen een `manual_url` als goed wanneer de server ook `application/pdf`
 * teruggeeft; bij een ander content-type volgt een download van de eerste
 * paar kB om te zien of het toch een PDF is (sommige servers geven een
 * verkeerde content-type header mee).
 *
 * Dit is dus het antwoord op "hoe weet ik of dit te vertrouwen is?": niet
 * aannemen dat een eerdere controle nog klopt, maar opnieuw ophalen. Sites
 * herstructureren; een link die vorige week werkte kan deze week dood zijn.
 * Draai dit script voor een nieuwe leverantie aan Jos, niet alleen bij het
 * toevoegen van een link.
 */

import { readSource } from "./lib/bronlijst.mts";
import type { CatalogRow } from "../../packages/core/src/catalog.ts";

const merkFilter = process.argv
  .find((a) => a.startsWith("--merk="))
  ?.slice(7)
  .trim()
  .toLowerCase();
const veldFilter = process.argv.find((a) => a.startsWith("--veld="))?.slice(7) as
  | "manual_url"
  | "product_page_url"
  | undefined;
const VELDEN = veldFilter ? [veldFilter] : (["manual_url", "product_page_url"] as const);

type Uitslag = "ok" | "geen-pdf" | "fout" | "timeout";

async function controleer(url: string, verwachtPdf: boolean): Promise<{ uitslag: Uitslag; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Gearonimo linkcheck)" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) return { uitslag: "fout", detail: `HTTP ${res.status}` };
    if (!verwachtPdf) return { uitslag: "ok", detail: `HTTP ${res.status}` };
    if (type.includes("pdf")) return { uitslag: "ok", detail: type };
    // Content-type klopt niet altijd; kijk naar de eerste bytes voordat we afkeuren.
    const buf = new Uint8Array(await res.arrayBuffer());
    const head = Buffer.from(buf.slice(0, 5)).toString("latin1");
    if (head === "%PDF-") return { uitslag: "ok", detail: `${type} (wel %PDF-header)` };
    return { uitslag: "geen-pdf", detail: type || "(geen content-type)" };
  } catch (e) {
    clearTimeout(timer);
    const msg = e instanceof Error ? e.message : String(e);
    return { uitslag: /abort/i.test(msg) ? "timeout" : "fout", detail: msg };
  }
}

const alle = readSource();
const rows = merkFilter ? alle.filter((r) => r.brand.trim().toLowerCase() === merkFilter) : alle;

// Dezelfde URL komt vaak bij tientallen producten voor (gedeelde handleiding);
// één keer ophalen per unieke URL, dan alle producten die hem gebruiken melden.
type Taak = { url: string; veld: string; rows: CatalogRow[] };
const taken = new Map<string, Taak>();
for (const r of rows) {
  for (const veld of VELDEN) {
    const url = r[veld].trim();
    if (!url) continue;
    const sleutel = `${veld}|${url}`;
    const t = taken.get(sleutel) ?? { url, veld, rows: [] };
    t.rows.push(r);
    taken.set(sleutel, t);
  }
}

console.log(`\n${taken.size} unieke links te controleren (${rows.length} producten)...\n`);

const kapot: { veld: string; url: string; detail: string; rows: CatalogRow[] }[] = [];
let goed = 0;
let index = 0;
for (const taak of taken.values()) {
  index++;
  const verwachtPdf = taak.veld === "manual_url";
  const { uitslag, detail } = await controleer(taak.url, verwachtPdf);
  if (uitslag === "ok") {
    goed++;
  } else {
    kapot.push({ veld: taak.veld, url: taak.url, detail, rows: taak.rows });
    console.log(`  [${index}/${taken.size}] KAPOT (${uitslag}, ${detail})\n    ${taak.veld}: ${taak.url}`);
  }
}

console.log(`\n${goed} van ${taken.size} links in orde.`);
if (kapot.length > 0) {
  console.log(`\n${kapot.length} kapotte links, ${kapot.reduce((n, k) => n + k.rows.length, 0)} producten geraakt:\n`);
  for (const k of kapot.sort((a, b) => b.rows.length - a.rows.length)) {
    console.log(`  ${String(k.rows.length).padStart(3)}x  [${k.veld}] ${k.detail}`);
    console.log(`       ${k.url}`);
    for (const r of k.rows.slice(0, 6)) console.log(`       - ${r.brand} ${r.name}`);
    if (k.rows.length > 6) console.log(`       … en nog ${k.rows.length - 6}`);
  }
}
console.log("");
