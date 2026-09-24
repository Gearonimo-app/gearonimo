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
 * teruggeeft; bij een ander content-type wordt gestreamd gekeken (eerste
 * paar bytes, niet het hele bestand) of het toch een PDF is (sommige
 * servers geven een verkeerde content-type header mee).
 *
 * Dit is dus het antwoord op "hoe weet ik of dit te vertrouwen is?": niet
 * aannemen dat een eerdere controle nog klopt, maar opnieuw ophalen. Sites
 * herstructureren; een link die vorige week werkte kan deze week dood zijn.
 * Draai dit script voor een nieuwe leverantie aan Jos, niet alleen bij het
 * toevoegen van een link.
 *
 * Veiligheid (code review): een manual_url/product_page_url komt uit een
 * aangeleverd bestand -- dus in principe van buiten. Vóór elke aanvraag (en
 * na elke doorverwijzing) wordt gecontroleerd dat het adres niet naar een
 * intern/lokaal netwerk wijst (localhost, 10.x, 192.168.x, cloud-metadata-
 * achtige link-local adressen, ...), zodat dit script niet als omweg naar
 * interne diensten gebruikt kan worden.
 */

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
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

// Hoeveel links tegelijk ophalen. Genoeg om honderden links in een redelijke
// tijd te doen, niet zoveel dat het op een aanval tegen de bron-server lijkt.
const CONCURRENCY = 6;
const MAX_REDIRECTS = 5;

type Uitslag = "ok" | "geen-pdf" | "fout" | "timeout";

// ─── SSRF-afscherming ───────────────────────────────────────────────────────

function isPrivateOrReservedIp(ip: string, family: number): boolean {
  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127 || a === 10 || a === 0) return true; // loopback / privé / "deze host"
    if (a === 172 && b >= 16 && b <= 31) return true; // privé
    if (a === 192 && b === 168) return true; // privé
    if (a === 169 && b === 254) return true; // link-local (o.a. cloud metadata: 169.254.169.254)
    if (a >= 224) return true; // multicast/gereserveerd
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80:")) return true; // link-local
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique local
  if (lower.startsWith("::ffff:")) return isPrivateOrReservedIp(lower.slice(7), 4);
  return false;
}

async function isSafeUrl(raw: string): Promise<{ safe: boolean; reason?: string }> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { safe: false, reason: "ongeldige URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { safe: false, reason: `niet-toegestaan protocol (${u.protocol})` };
  }
  const family = isIP(u.hostname);
  if (family) {
    return isPrivateOrReservedIp(u.hostname, family)
      ? { safe: false, reason: `intern/lokaal adres (${u.hostname})` }
      : { safe: true };
  }
  try {
    const { address, family: resolvedFamily } = await lookup(u.hostname);
    return isPrivateOrReservedIp(address, resolvedFamily)
      ? { safe: false, reason: `${u.hostname} wijst naar intern/lokaal adres (${address})` }
      : { safe: true };
  } catch {
    return { safe: false, reason: `${u.hostname} niet op te lossen` };
  }
}

/** Kijkt of de eerste bytes van de body "%PDF-" zijn, zonder de rest van een
 * eventueel groot (niet-PDF) bestand te downloaden. */
async function peekIsPdf(res: Response): Promise<boolean> {
  const reader = res.body?.getReader();
  if (!reader) return false;
  try {
    let received = new Uint8Array(0);
    while (received.length < 5) {
      const { done, value } = await reader.read();
      if (done) break;
      const merged = new Uint8Array(received.length + value.length);
      merged.set(received);
      merged.set(value, received.length);
      received = merged;
    }
    return Buffer.from(received.slice(0, 5)).toString("latin1") === "%PDF-";
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function controleer(startUrl: string, verwachtPdf: boolean): Promise<{ uitslag: Uitslag; detail: string }> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = await isSafeUrl(url);
    if (!check.safe) return { uitslag: "fout", detail: `geblokkeerd: ${check.reason}` };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    let res: Response;
    try {
      // redirect: "manual" i.p.v. "follow" -- elke doorverwijzing wordt hierboven
      // opnieuw op een intern/lokaal adres gecontroleerd vóór 'm gevolgd wordt.
      res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Gearonimo linkcheck)" },
        signal: controller.signal,
        redirect: "manual",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { uitslag: /abort/i.test(msg) ? "timeout" : "fout", detail: msg };
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel().catch(() => {});
      url = new URL(res.headers.get("location")!, url).toString();
      continue;
    }

    const type = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      await res.body?.cancel().catch(() => {});
      return { uitslag: "fout", detail: `HTTP ${res.status}` };
    }
    if (!verwachtPdf) {
      await res.body?.cancel().catch(() => {});
      return { uitslag: "ok", detail: `HTTP ${res.status}` };
    }
    if (type.includes("pdf")) {
      await res.body?.cancel().catch(() => {});
      return { uitslag: "ok", detail: type };
    }
    // Content-type klopt niet altijd; kijk naar de eerste bytes (gestreamd,
    // niet het hele bestand) voordat we afkeuren.
    const looksLikePdf = await peekIsPdf(res);
    return looksLikePdf
      ? { uitslag: "ok", detail: `${type} (wel %PDF-header)` }
      : { uitslag: "geen-pdf", detail: type || "(geen content-type)" };
  }
  return { uitslag: "fout", detail: "te veel doorverwijzingen" };
}

/** Verwerkt `items` met maximaal `concurrency` gelijktijdig, i.p.v. volledig
 * serieel -- bij honderden unieke links scheelt dit een veelvoud aan tijd. */
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function runner() {
    while (next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runner));
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
let afgehandeld = 0;
const totaal = taken.size;

await runPool([...taken.values()], CONCURRENCY, async (taak) => {
  const verwachtPdf = taak.veld === "manual_url";
  const { uitslag, detail } = await controleer(taak.url, verwachtPdf);
  afgehandeld++;
  if (uitslag === "ok") {
    goed++;
  } else {
    kapot.push({ veld: taak.veld, url: taak.url, detail, rows: taak.rows });
    console.log(`  [${afgehandeld}/${totaal}] KAPOT (${uitslag}, ${detail})\n    ${taak.veld}: ${taak.url}`);
  }
});

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
