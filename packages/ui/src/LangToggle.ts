// Gedeeld taalwissel-knopje (wens Jos 2026-07-19). Toont de taal waarnaar
// je wisselt ("EN" als de app Nederlands staat, "NL" andersom) -- bewust
// tekst en geen vlag-emoji (ontwerpafspraak: geen emoji in knoppen; een
// vlag dekt een taal bovendien slecht, Engels is niet alleen GB).
//
// Zelfde TS-render-aanpak als GIcon: geen SFC-compilatiestap nodig in de
// consumerende app. Schakelt de globale vue-i18n-locale en onthoudt de
// keuze via storeLocale.
import { defineComponent, h } from "vue";
import { useI18n } from "vue-i18n";
import { storeLocale, type UiLocale } from "./locale";

export const LangToggle = defineComponent({
  name: "LangToggle",
  props: {
    // 'dark' = op de donkergroene kopbalk/hero (glas-stijl, witte tekst);
    // 'light' = op een lichte pagina-achtergrond (bv. het inlogscherm).
    variant: { type: String as () => "dark" | "light", default: "dark" },
  },
  setup(props) {
    const { locale } = useI18n({ useScope: "global" });
    function toggle() {
      const next: UiLocale = locale.value === "nl" ? "en" : "nl";
      locale.value = next;
      storeLocale(next);
    }
    return () =>
      h(
        "button",
        {
          type: "button",
          class: "g-langtoggle",
          title: locale.value === "nl" ? "Switch to English" : "Naar Nederlands",
          style: {
            background: props.variant === "dark" ? "rgba(255,255,255,0.14)" : "#f3f4f6",
            border: props.variant === "dark" ? "1px solid rgba(255,255,255,0.3)" : "1px solid #d1d5db",
            color: props.variant === "dark" ? "#fff" : "#374151",
            borderRadius: "8px",
            padding: "0.25rem 0.55rem",
            fontSize: "0.78rem",
            fontWeight: "700",
            letterSpacing: "0.04em",
            cursor: "pointer",
            lineHeight: "1.2",
          },
          onClick: toggle,
        },
        locale.value === "nl" ? "EN" : "NL"
      );
  },
});
