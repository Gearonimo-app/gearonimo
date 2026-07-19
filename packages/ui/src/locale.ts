// Gedeelde taalvoorkeur voor beide apps (wens Jos 2026-07-19: de taal moet
// in de app zelf te wisselen zijn -- de en.json's bestonden al maar waren
// onbereikbaar met de hardcoded locale "nl").
//
// Voorkeur staat in localStorage (per toestel, net als de passkey-voorkeur);
// eerste bezoek volgt de browsertaal. Zelfde sleutel voor inspector- en
// klant-app: één toestel, één taalkeuze.

export type UiLocale = "nl" | "en";

const KEY = "gearonimo.locale";

export function initialLocale(): UiLocale {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "nl" || stored === "en") return stored;
  } catch {
    /* private mode e.d.: val terug op browsertaal */
  }
  return navigator.language?.toLowerCase().startsWith("en") ? "en" : "nl";
}

export function storeLocale(locale: UiLocale): void {
  try {
    localStorage.setItem(KEY, locale);
  } catch {
    /* opslag geweigerd: de keuze geldt dan alleen deze sessie */
  }
}
