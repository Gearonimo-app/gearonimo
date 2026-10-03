import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DB_ERRORS, translateDbError } from "./dbErrors";

// Alle `raise exception`-teksten uit ALLE migraties (behalve platform-admin-
// functies: die ziet alleen de platformbeheerder, in het Nederlands).
// Bewust niet "alleen de laatste definitie": de bestandsnamen staan niet in
// de volgorde waarin ze gemaakt zijn (20260766 is van ná 20260917), en een
// gok daarover liep op 2026-10-03 al eens mis. Alles vertalen is altijd goed.
function databaseMessages(): Map<string, string> {
  const dir = join(__dirname, "../../../supabase/migrations");
  const out = new Map<string, string>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(dir, file), "utf8");
    const re = /create or replace function public\.(\w+)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      if (m[1].startsWith("platform_admin_")) continue;
      const next = sql.indexOf("create or replace function", m.index + 1);
      const body = sql.slice(m.index, next > 0 ? next : sql.length);
      for (const r of body.matchAll(/raise exception '((?:[^']|'')*)'/g)) out.set(r[1].replace(/''/g, "'"), `${file} ${m[1]}`);
    }
  }
  return out;
}

describe("databasemeldingen vertaald", () => {
  it("elke melding uit de migraties staat in DB_ERRORS", () => {
    const missing = [...databaseMessages()].filter(([msg]) => !(msg in DB_ERRORS)).map(([msg, fn]) => `${fn}: ${msg}`);
    expect(missing).toEqual([]);
  });

  it("vertaalt, ook met een ingevulde waarde", () => {
    expect(translateDbError("Geen klantkoppeling voor dit account.", "en")).toBe("This account is not linked to a customer.");
    expect(translateDbError("Deze materiaalsoort bevat nog 3 artikel(en); voer die eerst af.", "en")).toBe(
      "This equipment type still contains 3 item(s); retire them first."
    );
    expect(translateDbError("Onbekend producttype: kabel", "de")).toBe("Unbekannter Produkttyp: kabel");
  });

  it("Nederlands en onbekende meldingen blijven zoals ze zijn", () => {
    expect(translateDbError("Geen klantkoppeling voor dit account.", "nl")).toBe("Geen klantkoppeling voor dit account.");
    expect(translateDbError("permission denied for table x", "en")).toBe("permission denied for table x");
  });
});
