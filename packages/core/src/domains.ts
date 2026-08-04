/**
 * Materiaal-tegels in de klant-app (ontwerpbesluit Jos 2026-08-04, uitgeschreven
 * in `UX-FLOW.md §9.6`).
 *
 * Een tegel is een **weergave**, geen eigenschap van een artikel. Op `articles`
 * staat dus geen tegel-kolom: in welke tegel iets valt, volgt uit zijn
 * `product_type`. Zo kunnen die twee het nooit oneens zijn.
 *
 * Waarom deze laag bestaat: `ppe` / `no_ppe` / `rigging` is keurmeester-taal —
 * het verschil bepaalt een keurregime. Een klant denkt "mijn klimspullen".
 * De tegel verbergt dat jargon. Precies daarom staat de indeling **vast** en
 * is hij niet per klant instelbaar: hij vereenvoudigt, hij is geen extra as om
 * te beheren.
 *
 * ⚠ Deze afbeelding staat ook in SQL, als `public.domain_for_type()` (migratie
 * `20260752_material_domains.sql`). SQL kan geen TypeScript importeren, en de
 * controle "een tegel met inhoud kan niet uit" móet serverside staan. Bewuste
 * duplicatie van vijf regels: wijzig je er één, wijzig dan de ander.
 */
import { NO_INSPECTION_TYPES, type ProductType } from "./regimes";

export const MATERIAL_DOMAINS = [
  "climbing",
  "machines",
  "clothing",
  "other",
] as const;

export type MaterialDomain = (typeof MATERIAL_DOMAINS)[number];

/** Welke producttypes vallen onder welke tegel. */
export const DOMAIN_PRODUCT_TYPES: Record<MaterialDomain, readonly ProductType[]> = {
  climbing: ["ppe", "no_ppe", "rigging"],
  machines: ["machine"],
  clothing: ["clothing"],
  other: ["other"],
};

/**
 * De tegel waar dit type in valt.
 *
 * Leeg of onbekend → `climbing`. Dat is niet willekeurig: vrije artikelen van
 * vóór 2026-08-04 hebben geen type (zie `articles.free_product_type`), en alles
 * wat er toen stond was klimmateriaal. Dezelfde afspraak als in SQL.
 */
export function domainForType(product_type?: string | null): MaterialDomain {
  switch ((product_type ?? "").trim()) {
    case "machine":
      return "machines";
    case "clothing":
      return "clothing";
    case "other":
      return "other";
    default:
      return "climbing";
  }
}

/**
 * `climbing` staat altijd aan — het is de basis van de app, en uitzetten zou
 * een lege startpagina geven. Ook afgedwongen in `set_my_enabled_domains()`.
 */
export const ALWAYS_ON_DOMAIN: MaterialDomain = "climbing";

/** Alleen de bekende waarden, ontdubbeld, met `climbing` er altijd bij. */
export function normalizeDomains(input?: readonly string[] | null): MaterialDomain[] {
  const known = new Set<MaterialDomain>([ALWAYS_ON_DOMAIN]);
  for (const d of input ?? []) {
    if ((MATERIAL_DOMAINS as readonly string[]).includes(d)) {
      known.add(d as MaterialDomain);
    }
  }
  return MATERIAL_DOMAINS.filter((d) => known.has(d));
}

/**
 * Wordt binnen deze tegel überhaupt iets gekeurd? Bepaalt of een keurstatus
 * (stoplicht, "aandacht", "eerste keuring te laat") zinnig is. Kleding en
 * Overig leveren `false`; Klimmateriaal `true`, ook al wordt `no_ppe` daarbinnen
 * niet gekeurd.
 */
export function domainHasInspections(domain: MaterialDomain): boolean {
  return DOMAIN_PRODUCT_TYPES[domain].some(
    (t) => !NO_INSPECTION_TYPES.includes(t)
  );
}

/**
 * Heeft dit type een keurtermijn? Losse helper zodat de klant-app niet zelf
 * `NO_INSPECTION_TYPES` hoeft te kennen. Een leeg/onbekend type telt als `ppe`
 * — dus wél gekeurd, de veilige kant op (zie `regimes.ts`).
 */
export function typeIsInspected(product_type?: string | null): boolean {
  const t = ((product_type ?? "").trim() || "ppe") as ProductType;
  return !NO_INSPECTION_TYPES.includes(t);
}

/**
 * Types die buiten het keurbedrijf vallen: geen keurmeester ziet ze, hun status
 * komt niet uit `inspections` (besluit Jos 2026-08-04, "voor nu standaard self
 * managed").
 *
 * `no_ppe` staat er bewust NIET in: klimsporen en voetklemmen worden in de
 * praktijk vaak meegekeurd, dus die moet de keurmeester gewoon zien.
 *
 * ⚠ Ook in SQL, als `public.type_is_self_managed()` (migratie
 * `20260753_self_managed_domains.sql`). Daar is het de autoriteit — een trigger
 * op `articles` zet `self_managed` zelf goed. Wijzig je er één, wijzig de ander.
 */
export const SELF_MANAGED_TYPES: readonly ProductType[] = [
  "clothing",
  "machine",
  "other",
];

export function typeIsSelfManaged(product_type?: string | null): boolean {
  const t = ((product_type ?? "").trim() || "ppe") as ProductType;
  return SELF_MANAGED_TYPES.includes(t);
}

/**
 * Beperkt een Supabase-query op `articles` tot wat een keurmeester mag zien.
 *
 * Eén helper in plaats van `.eq('self_managed', false)` op vijf plekken — en
 * één plek om aan te passen als de regel verandert. Bewust op de kolom
 * `self_managed` en niet op producttype: het type zit soms op `products` (via
 * een join) en soms op `articles.free_product_type`, wat in elke query een
 * andere constructie zou opleveren.
 */
// Het typeparameter is bewust ONgebonden (geen `Q extends { eq(...) }`): met
// een structurele constraint gaat TypeScript de PostgREST-buildertypes
// uitrollen en klapt vue-tsc op TS2589 "type instantiation is excessively
// deep". De cast binnenin doet het werk; de aanroeper houdt zijn eigen type.
export function inspectorVisibleArticles<Q>(query: Q): Q {
  return (query as unknown as { eq(column: string, value: unknown): Q }).eq(
    "self_managed",
    false
  );
}
