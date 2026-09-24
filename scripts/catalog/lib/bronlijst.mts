/**
 * De bronlijst: inlezen, samenvoegen en wegschrijven.
 *
 * `catalog/producten.csv` is de bron. Alles wat Jos aanlevert (Excel of CSV)
 * wordt hier ingevoegd; alles wat naar Gearonimo gaat komt hier vandaan.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { csvToObjects, objectsToCsv } from "./csv.mts";
import {
  CATALOG_COLUMNS,
  productKey,
  type CatalogRow,
  type CatalogColumn,
} from "../../../packages/core/src/catalog.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, "../../..");
export const SOURCE_FILE = resolve(REPO_ROOT, "catalog/producten.csv");
export const INBOX_DIR = resolve(REPO_ROOT, "catalog/inbox");
export const EXPORT_DIR = resolve(REPO_ROOT, "catalog/export");

/** Lege rij met alle kolommen, zodat er nooit een `undefined` doorheen glipt. */
export function emptyRow(): CatalogRow {
  return Object.fromEntries(CATALOG_COLUMNS.map((c) => [c, ""])) as CatalogRow;
}

/**
 * Leest een tekstbestand als UTF-8, met een controle die verkeerde codering
 * signaleert i.p.v. stil laat corrumperen.
 *
 * Excel's gewone "CSV (Comma delimited)"-export (i.t.t. "CSV UTF-8") schrijft
 * Windows-1252/ANSI, niet UTF-8. `Buffer#toString("utf8")` decodeert zulke
 * bytes gewoon (leesbaar-lijkend, maar corrupt bij é/ü/°/® e.d.) zonder ooit
 * een fout te geven -- de eerste keer dat iemand het zou merken is een rare
 * tekenreeks op het certificaat. `TextDecoder` met `fatal: true` gooit wél
 * een fout bij een ongeldige UTF-8-byte, dus dat geeft een harde waarschuwing
 * i.p.v. stille schade. Bewust geen extra afhankelijkheid voor een volledige
 * codering-gok (chardet e.d.) -- deze repo houdt dat bewust klein.
 */
function readTextFile(path: string): string {
  const buf = readFileSync(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    console.warn(
      `  let op: ${basename(path)} lijkt geen geldige UTF-8-tekst -- controleer speciale ` +
        `tekens (é, ü, °). Excel: kies bij exporteren "CSV UTF-8" i.p.v. gewoon "CSV".`
    );
    return buf.toString("latin1");
  }
}

/**
 * Lees een aangeleverd bestand: .xlsx, .xls of .csv.
 *
 * Excel gaat door SheetJS — dezelfde bibliotheek die de app zelf gebruikt bij
 * import en export, dus wat hier binnenkomt is precies wat Gearonimo eruit
 * heeft geschreven.
 */
export function readAnyFile(path: string): Record<string, string>[] {
  if (/\.csv$/i.test(path)) {
    return csvToObjects(readTextFile(path));
  }

  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  return raw.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k.trim()] = v == null ? "" : String(v).trim();
    }
    return out;
  });
}

/**
 * Kolommen die de database als `numeric` bewaart en dus in een eigen
 * schrijfwijze teruggeeft: "11.00" komt eruit als "11", "11.50" als "11.5".
 */
const NUMERIEKE_KOLOMMEN = [
  "rope_diameter_min_mm",
  "rope_diameter_max_mm",
] as const satisfies readonly CatalogColumn[];

/**
 * Zet een getal in dezelfde schrijfwijze als de database teruggeeft.
 *
 * Zonder dit meldt een vergelijking met een verse export eeuwig verschillen
 * die er niet zijn: 39 producten stonden hier als "11.00" en in Gearonimo als
 * "11". Zelfde diameter, andere notatie — maar `--sinds=` zag ze als gewijzigd
 * en zou ze bij elke ronde opnieuw laten bijwerken.
 *
 * Alleen voor `numeric`-kolommen. Velden als `max_user_weight_kg` blijven
 * ongemoeid: daar staat legitiem "130-150" of "100 (bij EN 12841/B)" in.
 */
function normaliseerGetal(waarde: string): string {
  const v = waarde.trim();
  if (!v) return v;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : v;
}

/** Beperk een aangeleverde rij tot de kolommen die de catalogus kent. */
export function toCatalogRow(raw: Record<string, string>): CatalogRow {
  const row = emptyRow();
  for (const col of CATALOG_COLUMNS) {
    row[col] = (raw[col] ?? "").trim();
  }
  for (const col of NUMERIEKE_KOLOMMEN) {
    row[col] = normaliseerGetal(row[col]);
  }
  return row;
}

/** Kolommen in een aangeleverd bestand die de catalogus niet kent. */
export function unknownColumns(raw: Record<string, string>): string[] {
  const known = new Set<string>(CATALOG_COLUMNS);
  return Object.keys(raw).filter((k) => k !== "" && !known.has(k));
}

export function readSource(): CatalogRow[] {
  if (!existsSync(SOURCE_FILE)) return [];
  return csvToObjects(readFileSync(SOURCE_FILE, "utf8")).map(toCatalogRow);
}

/**
 * Vaste sortering op merk, dan omschrijving.
 *
 * Zonder vaste volgorde zou een aangeleverd bestand in een andere volgorde de
 * hele CSV overhoop halen, en dan toont `git diff` 2294 gewijzigde regels
 * terwijl er misschien één product veranderd is.
 */
export function sortRows(rows: CatalogRow[]): CatalogRow[] {
  const collator = new Intl.Collator("nl", { sensitivity: "base", numeric: true });
  return [...rows].sort(
    (a, b) =>
      collator.compare(a.brand, b.brand) || collator.compare(a.name, b.name)
  );
}

export function writeSource(rows: CatalogRow[]): void {
  writeFileSync(SOURCE_FILE, objectsToCsv(sortRows(rows), CATALOG_COLUMNS));
}

export interface FieldChange {
  column: CatalogColumn;
  from: string;
  to: string;
}

export interface RowChange {
  product: string;
  fields: FieldChange[];
}

export interface MergeResult {
  rows: CatalogRow[];
  added: string[];
  updated: RowChange[];
  unchanged: number;
  /** Bestaande waarden die het aangeleverde bestand leeg liet. */
  keptBlank: RowChange[];
  /**
   * Rijen waar het aangeleverde bestand een ANDERE, niet-lege id meebracht
   * dan de rij waarmee het op merk+naam matchte. De bestaande id is behouden;
   * dit hoort nooit automatisch toegepast te worden (zie mergeRows).
   */
  idConflicts: RowChange[];
}

/**
 * Voeg een aangeleverd bestand samen met de bronlijst.
 *
 * Herkenning: eerst op `id` (die komt uit de database en is hard), anders op
 * merk + omschrijving — dezelfde regel als de unieke index.
 *
 * De belangrijkste regel: **een lege cel wist niets.** Levert een bestand
 * alleen merk, naam en handleiding-link aan, dan blijven de breuksterkte en
 * de levensduur die al in de bronlijst stonden gewoon staan. Anders zou elk
 * gedeeltelijk lijstje stilletjes de rest van de catalogus leegvegen — precies
 * de manier waarop hier eerder werk verdween.
 *
 * Wil je een waarde wél weghalen, dan kan dat expliciet met `overwrite`, of
 * door de waarde in de bronlijst zelf aan te passen.
 */
export function mergeRows(
  current: CatalogRow[],
  incoming: CatalogRow[],
  { overwrite = false }: { overwrite?: boolean } = {}
): MergeResult {
  const rows = current.map((r) => ({ ...r }));
  const byId = new Map<string, CatalogRow>();
  const byKey = new Map<string, CatalogRow>();
  for (const row of rows) {
    if (row.id) byId.set(row.id, row);
    if (row.brand && row.name) byKey.set(productKey(row.brand, row.name), row);
  }

  const added: string[] = [];
  const updated: RowChange[] = [];
  const keptBlank: RowChange[] = [];
  const idConflicts: RowChange[] = [];
  let unchanged = 0;

  for (const incomingRow of incoming) {
    const label = `${incomingRow.brand} ${incomingRow.name}`.trim();
    const existing =
      (incomingRow.id ? byId.get(incomingRow.id) : undefined) ??
      (incomingRow.brand && incomingRow.name
        ? byKey.get(productKey(incomingRow.brand, incomingRow.name))
        : undefined);

    if (!existing) {
      const fresh = { ...incomingRow };
      rows.push(fresh);
      if (fresh.id) byId.set(fresh.id, fresh);
      if (fresh.brand && fresh.name) {
        byKey.set(productKey(fresh.brand, fresh.name), fresh);
      }
      added.push(label);
      continue;
    }

    const fields: FieldChange[] = [];
    const blanked: FieldChange[] = [];
    const conflicts: FieldChange[] = [];

    for (const col of CATALOG_COLUMNS) {
      const to = incomingRow[col];
      const from = existing[col];
      if (to === from) continue;

      // De `id` mag nooit wijzigen als de rij er al één heeft -- niet naar
      // leeg (ook niet met `overwrite`) en ook niet naar een ANDERE waarde.
      // Die komt uit de database en is de enige manier om een bestaand
      // product bij te werken in plaats van te dupliceren of te koppelen aan
      // het verkeerde record. Matcht een aangeleverd bestand deze rij op
      // merk+naam en brengt het toevallig zelf een afwijkend id mee (bv. een
      // verouderde export), dan wordt dat genegeerd en gemeld -- nooit stil
      // toegepast (code review 2026-09-15).
      if (col === "id" && from !== "") {
        if (to !== "") conflicts.push({ column: col, from, to });
        else blanked.push({ column: col, from, to });
        continue;
      }

      // Lege cel wist niets, tenzij `overwrite` (zie module-comment hierboven).
      if (to === "" && !overwrite) {
        if (from !== "") blanked.push({ column: col, from, to });
        continue;
      }
      fields.push({ column: col, from, to });
    }

    for (const change of fields) {
      // De sleutel kan meeveranderen (merk/naam bijgewerkt); de kaart bijhouden
      // zodat een tweede rij in hetzelfde bestand dit product nog vindt.
      if (change.column === "brand" || change.column === "name") {
        byKey.delete(productKey(existing.brand, existing.name));
      }
      existing[change.column] = change.to;
      if (change.column === "brand" || change.column === "name") {
        byKey.set(productKey(existing.brand, existing.name), existing);
      }
      if (change.column === "id" && change.to) byId.set(change.to, existing);
    }

    if (fields.length > 0) updated.push({ product: label, fields });
    else unchanged++;
    if (blanked.length > 0) keptBlank.push({ product: label, fields: blanked });
    if (conflicts.length > 0) idConflicts.push({ product: label, fields: conflicts });
  }

  return { rows, added, updated, unchanged, keptBlank, idConflicts };
}
