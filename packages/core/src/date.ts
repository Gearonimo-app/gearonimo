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
