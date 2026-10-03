/**
 * Lokale datum als 'yyyy-mm-dd', NIET via `toISOString()`.
 *
 * `toISOString()` rekent om naar UTC: tussen lokale middernacht en de
 * NL-tijdzoneverschuiving (00:00-02:00 CEST 's zomers, 00:00-01:00 CET
 * 's winters) geeft dat nog de datum van GISTEREN terug. Dat leverde eerder
 * een next_due die één dag te vroeg op het certificaat kwam (code review
 * 2026-07-18), en -- vóórdat deze functie hierheen verplaatst was -- dezelfde
 * bug opnieuw in de klantportal bij het selecteren van de zelfcheck-datum
 * (code review 2026-09-15). Eén gedeelde bron in plaats van dat elke
 * app/pagina 'm zelf opnieuw uitschrijft.
 */
export function toIsoDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Datum voor weergave, in de gekozen app-taal.
 *
 * Stond hiervoor los uitgeschreven met `toLocaleDateString('nl-NL', ...)` op
 * 12 plekken in beide apps (code review): een Franse of Engelse gebruiker
 * kreeg dus overal Nederlandse maandnamen te zien, ondanks de taalkeuze in
 * de app. `locale` is de vue-i18n-locale ("nl"/"en"/"fr"/"de", zie
 * packages/ui/src/locale.ts) -- die geeft Intl een geldige taalcode.
 */
export function formatDate(
  d: string | Date,
  locale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return typeof d === "string" ? d : "";
  return date.toLocaleDateString(dateLocale(locale), opts);
}

/**
 * App-taal ("en") → land-specifieke datumnorm ("en-GB").
 *
 * Een kale taalcode laat Intl de standaardregio kiezen, en voor "en" is dat de
 * VS: "April 2, 2027" en 4/2/2027 (maand eerst). Een Brits keurbedrijf hoort
 * de Britse norm te zien (Jos, 2026-10-02: "alle data naar de norm van het
 * land"). Gearonimo bedient NL en GB, en straks DE/FR -- geen VS -- dus elke
 * taal krijgt de norm van zijn land. Een code mét regio blijft ongemoeid.
 */
const DATE_REGION: Record<string, string> = { en: "en-GB", nl: "nl-NL", de: "de-DE", fr: "fr-FR" };
export function dateLocale(locale: string): string {
  return DATE_REGION[locale] ?? locale;
}

/**
 * Naam van maand 1-12 in de app-taal ("Mar", "mrt", "Mär", "mars").
 * Stond als vaste Nederlandse lijst in de keuring, waardoor de Engelse app
 * "mrt", "mei" en "okt" toonde (live test 2026-10-03).
 */
export function monthName(month: number, locale: string, width: "short" | "long" = "short"): string {
  return new Intl.DateTimeFormat(dateLocale(locale), { month: width }).format(new Date(2000, month - 1, 1));
}
