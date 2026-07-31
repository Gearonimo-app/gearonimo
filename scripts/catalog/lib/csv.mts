/**
 * CSV lezen en schrijven voor de bronlijst.
 *
 * De bronlijst staat als CSV in git en niet als Excel, met opzet: een CSV is
 * regel voor regel te vergelijken, dus `git diff` laat zien wélke producten
 * er veranderd zijn. Een .xlsx is een zipbestand — git ziet daar alleen
 * "bestand gewijzigd" en het overzicht is dan meteen weer weg.
 *
 * Het schrijven is bewust voorspelbaar (vaste kolomvolgorde, vaste sortering,
 * altijd \n): twee keer dezelfde inhoud geeft byte voor byte hetzelfde
 * bestand, zodat een diff alleen echte inhoudswijzigingen toont.
 */

/**
 * Splits één CSV-tekst in rijen en cellen.
 *
 * Zelfgeschreven en geen bibliotheek, omdat het formaat hier klein is en de
 * repo bewust weinig afhankelijkheden heeft. Ondersteunt wat Excel er
 * daadwerkelijk uitgooit: aanhalingstekens om cellen, dubbele aanhalingstekens
 * als ontsnapping, regeleindes binnen een cel, en \r\n.
 */
export function parseCsv(text: string, delimiter = ","): string[][] {
  // Een BOM aan het begin hoort niet bij de eerste kolomnaam. Zonder dit
  // heet de eerste kolom "﻿id" en wordt hij niet herkend.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      // \r\n telt als één regeleinde.
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }

  // Laatste regel zonder afsluitend regeleinde.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/**
 * Raad het scheidingsteken van een CSV.
 *
 * Nederlandse Excel schrijft standaard puntkomma's. Zonder deze detectie komt
 * zo'n bestand binnen als één kolom met de hele regel erin, en dan lijkt het
 * of alle producten hun merk kwijt zijn.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  // Tellen buiten aanhalingstekens, anders telt een komma in "Petzl, groot" mee.
  const count = (delim: string) => {
    let n = 0;
    let quoted = false;
    for (let i = 0; i < firstLine.length; i++) {
      const c = firstLine[i];
      if (c === '"') quoted = !quoted;
      else if (c === delim && !quoted) n++;
    }
    return n;
  };
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, d) => (count(d) > count(best) ? d : best), ",");
}

/**
 * Lees een CSV-tekst als rijen met kolomnamen.
 * Onbekende kolommen blijven staan; daar meldt de controle apart over.
 */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text, detectDelimiter(text));
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    // Een lege regel onderaan het bestand is geen product.
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h] = (r[i] ?? "").trim();
      });
      return obj;
    });
}

/** Zet één cel om naar CSV: alleen aanhalingstekens als het echt moet. */
function quote(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Schrijf rijen als CSV met een vaste kolomvolgorde. */
export function objectsToCsv(
  rows: Record<string, string>[],
  columns: readonly string[]
): string {
  const lines = [columns.map(quote).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => quote(row[c] ?? "")).join(","));
  }
  return lines.join("\n") + "\n";
}
