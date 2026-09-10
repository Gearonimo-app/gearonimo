import { useI18n } from "vue-i18n";
import { CATEGORIES } from "@gearonimo/core";

/**
 * Vertaal een `category`-code (`products.category`, sinds 2026-09-10 een
 * vaste lijst, zie CATEGORIES) naar het label in de huidige taal.
 *
 * Een waarde die niet in CATEGORIES staat — `free_category` van een vrij
 * artikel, of een catalogusrij die de migratie nog niet heeft gehad — is
 * vrije tekst en blijft ongemoeid: die vertalen zou een verzinsel tonen.
 */
export function useCategoryLabel() {
  const { t } = useI18n();
  return (code: string | null | undefined): string => {
    if (!code) return "";
    return (CATEGORIES as readonly string[]).includes(code)
      ? t(`settings.catalog.categories.${code}`)
      : code;
  };
}
