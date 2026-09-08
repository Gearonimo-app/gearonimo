// Gedeeld taalkeuze-knopje (wens Jos 2026-07-19, uitgebreid naar 4 talen
// 2026-09-08). Was een NL/EN-toggle-knop; met fr/de erbij past een simpele
// "wissel naar de andere taal"-knop niet meer, dus een keuzelijst. Bewust een
// native <select> i.p.v. een zelfgebouwd dropdown-menu (geen fragiel
// bouwsel met eigen click-outside/keyboard-logica voor iets dat de browser
// al goed doet) -- en bewust taalcodes, geen vlag-emoji (ontwerpafspraak:
// geen emoji in knoppen; een vlag dekt een taal bovendien slecht, Engels is
// niet alleen GB).
//
// Zelfde TS-render-aanpak als GIcon: geen SFC-compilatiestap nodig in de
// consumerende app. Schakelt de globale vue-i18n-locale en onthoudt de
// keuze via storeLocale.
import { defineComponent, h } from "vue";
import { useI18n } from "vue-i18n";
import { storeLocale, type UiLocale } from "./locale";

const LOCALES: readonly UiLocale[] = ["nl", "en", "fr", "de"];
const LABELS: Record<UiLocale, string> = { nl: "NL", en: "EN", fr: "FR", de: "DE" };

export const LangToggle = defineComponent({
  name: "LangToggle",
  props: {
    // 'dark' = op de donkergroene kopbalk/hero (glas-stijl, witte tekst);
    // 'light' = op een lichte pagina-achtergrond (bv. het inlogscherm).
    variant: { type: String as () => "dark" | "light", default: "dark" },
  },
  setup(props) {
    const { locale } = useI18n({ useScope: "global" });
    function onChange(e: Event) {
      const next = (e.target as HTMLSelectElement).value as UiLocale;
      locale.value = next;
      storeLocale(next);
    }
    return () =>
      h(
        "select",
        {
          class: "g-langtoggle",
          title: "Taal / Language / Langue / Sprache",
          "aria-label": "Taal / Language / Langue / Sprache",
          value: locale.value,
          style: {
            background: props.variant === "dark" ? "rgba(255,255,255,0.14)" : "#f3f4f6",
            border: props.variant === "dark" ? "1px solid rgba(255,255,255,0.3)" : "1px solid #d1d5db",
            color: props.variant === "dark" ? "#fff" : "#374151",
            borderRadius: "8px",
            padding: "0.25rem 1.35rem 0.25rem 0.55rem",
            fontSize: "0.78rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
            cursor: "pointer",
            lineHeight: "1.2",
            // Systeempijltje laten staan (native select), alleen de kleur
            // volgt de variant zodat hij op de donkere kopbalk zichtbaar blijft.
            colorScheme: props.variant === "dark" ? "dark" : "light",
          },
          onChange,
        },
        LOCALES.map((l) =>
          h(
            "option",
            {
              key: l,
              value: l,
              style: { color: "#111827", background: "#fff" },
            },
            LABELS[l]
          )
        )
      );
  },
});
