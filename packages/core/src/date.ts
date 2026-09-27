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
  return date.toLocaleDateString(locale, opts);
}
