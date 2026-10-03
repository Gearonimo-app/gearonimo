// Taal van een keurbedrijf, afgeleid van zijn land: NL/BE = nl, FR = fr,
// DE/AT/CH = de, al het andere = en. Bepaalt de taal van het certificaat.
// Zelfde tabel staat in SQL als public.locale_for_country() (herinneringsmail,
// migratie 20261010) -- wijzig je de één, wijzig dan de ander.
export type CompanyLanguage = "nl" | "en" | "fr" | "de";

export function languageForCountry(countryCode: string | null | undefined): CompanyLanguage {
  const c = countryCode ?? "NL";
  if (["NL", "BE"].includes(c)) return "nl";
  if (c === "FR") return "fr";
  if (["DE", "AT", "CH"].includes(c)) return "de";
  return "en";
}
