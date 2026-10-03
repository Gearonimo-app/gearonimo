// Volgorde van de artikelen op het certificaat (Jos, 2026-10-03): eerst per
// gebruiker, daarbinnen per categorie, daarbinnen per merk -- "zo staat het
// per gebruiker bij elkaar en staan alle Petzl-karabijnhaken bij elkaar".
// Daarna artikelnaam en serienummer, zodat de volgorde vastligt.
//
// Eén bron: het certificaat (PDF) en de Excel-export sorteren hiermee, en de
// QR-pagina leest de volgorde terug die bij het maken van het certificaat is
// opgeslagen (certificates.item_order). Lege waarden komen per niveau
// onderaan (artikelen zonder gebruiker dus aan het eind). Hoofdletters en
// accenten tellen niet mee; getallen in tekst tellen als getal (SN 2 vóór SN 10).

export interface CertSortFields {
  user: string | null;
  category: string | null;
  brand: string | null;
  name: string | null;
  serial_number: string | null;
}

const LEVELS: (keyof CertSortFields)[] = ["user", "category", "brand", "name", "serial_number"];

export function compareCertItems(locale: string): (a: CertSortFields, b: CertSortFields) => number {
  const collator = new Intl.Collator(locale, { sensitivity: "base", numeric: true });
  return (a, b) => {
    for (const key of LEVELS) {
      const x = (a[key] ?? "").trim();
      const y = (b[key] ?? "").trim();
      if (x === y) continue;
      if (!x) return 1;
      if (!y) return -1;
      const c = collator.compare(x, y);
      if (c !== 0) return c;
    }
    return 0;
  };
}

/** Nieuwe, gesorteerde lijst; bij volledig gelijke regels blijft de oorspronkelijke volgorde. */
export function sortCertItems<T extends CertSortFields>(items: readonly T[], locale: string): T[] {
  return [...items].sort(compareCertItems(locale));
}
