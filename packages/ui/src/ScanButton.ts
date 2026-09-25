// Gedeeld scan-knopje + camera-overlay (QR/DataMatrix/barcode) -- besloten
// met Jos 2026-09-12, drie plekken: keuringswizard, artikel toevoegen
// (keurmeester) en artikel toevoegen (klant zelf). Zelfde TS-render-aanpak
// als GIcon/LangToggle: geen SFC-compilatiestap nodig in de consumerende app.
//
// Zelfstandig: de aanroeper hoeft alleen `@scan="tekst => ..."` te vangen,
// het knopje regelt zijn eigen open/dicht-status en camera-opruiming.
import { defineComponent, h, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { GIcon } from "./GIcon";
import { useScanner } from "./useScanner";

let idCounter = 0;

export const ScanButton = defineComponent({
  name: "ScanButton",
  props: {
    // Titel/aria-label van het knopje zelf (bv. "Scan serienummer").
    title: { type: String, default: undefined },
  },
  emits: {
    scan: (_text: string) => true,
  },
  setup(props, { emit }) {
    const elementId = `g-scanner-reader-${++idCounter}`;
    const scanner = useScanner();

    async function openScanner() {
      await scanner.open(elementId, (text) => emit("scan", text));
      if (scanner.error.value === "unavailable") {
        window.alert(t("scanner.unavailable"));
      }
    }

    onBeforeUnmount(() => {
      if (scanner.isOpen.value) scanner.close();
    });

    // vue-i18n: de host-apps hebben elk hun eigen "scanner"-namespace in
    // hun locale-bestanden (net als bij LangToggle geen gedeelde i18n-bron --
    // packages/ui heeft zelf geen locales/*.json).
    const { t } = useI18n({ useScope: "global" });

    function renderButton() {
      return h(
        "button",
        {
          type: "button",
          class: "g-scanbtn",
          title: props.title ?? t("scanner.button"),
          "aria-label": props.title ?? t("scanner.button"),
          onClick: openScanner,
          style: {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.25rem",
            height: "2.25rem",
            flex: "none",
            padding: "0",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            background: "#fff",
            color: "#374151",
            cursor: "pointer",
          },
        },
        [h(GIcon, { name: "scan", style: { width: "1.15rem", height: "1.15rem" } })]
      );
    }

    function renderControls() {
      if (!scanner.hasMacro.value && !scanner.hasZoom.value && !scanner.hasTorch.value) return null;
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "500px", marginTop: "0.75rem" } },
        [
          scanner.hasZoom.value
            ? h("input", {
                type: "range",
                min: scanner.zoomMin.value,
                max: scanner.zoomMax.value,
                step: scanner.zoomStep.value,
                value: scanner.zoomValue.value,
                onInput: (e: Event) => scanner.setZoom(parseFloat((e.target as HTMLInputElement).value)),
                style: { width: "100%", accentColor: "#8BC53F" },
              })
            : null,
          h("div", { style: { display: "flex", gap: "0.5rem", justifyContent: "center" } }, [
            scanner.hasMacro.value
              ? h(
                  "button",
                  {
                    type: "button",
                    onClick: scanner.toggleMacro,
                    style: controlBtnStyle(scanner.macroOn.value),
                  },
                  t("scanner.macro")
                )
              : null,
            scanner.hasTorch.value
              ? h(
                  "button",
                  {
                    type: "button",
                    onClick: scanner.toggleTorch,
                    style: controlBtnStyle(scanner.torchOn.value),
                  },
                  t("scanner.torch")
                )
              : null,
          ]),
        ]
      );
    }

    function renderOverlay() {
      if (!scanner.isOpen.value) return null;
      return h(
        "div",
        {
          style: {
            position: "fixed",
            inset: "0",
            background: "rgba(0,0,0,.92)",
            zIndex: "10000",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
          },
          onClick: (e: MouseEvent) => {
            if (e.target === e.currentTarget) scanner.close();
          },
        },
        [
          h("div", { style: { color: "#fff", textAlign: "center", marginBottom: "1rem" } }, [
            h("div", { style: { fontSize: "1.1rem", fontWeight: "700", marginBottom: "0.25rem" } }, t("scanner.title")),
            h("div", { style: { fontSize: "0.8rem", opacity: "0.7" } }, t("scanner.subtitle")),
          ]),
          h("div", { id: elementId, style: { width: "100%", maxWidth: "500px", borderRadius: "12px", overflow: "hidden" } }),
          scanner.lastResult.value
            ? h(
                "div",
                { style: { color: "#8BC53F", fontSize: "1rem", fontWeight: "600", marginTop: "1rem" } },
                `✓ ${scanner.lastResult.value}`
              )
            : null,
          renderControls(),
          h(
            "button",
            {
              type: "button",
              onClick: () => scanner.close(),
              style: {
                marginTop: "1.25rem",
                padding: "0.6rem 2rem",
                background: "none",
                border: "2px solid rgba(255,255,255,.4)",
                color: "#fff",
                borderRadius: "10px",
                fontSize: "0.9rem",
                fontWeight: "600",
                cursor: "pointer",
              },
            },
            t("scanner.close")
          ),
        ]
      );
    }

    return () => [renderButton(), renderOverlay()];
  },
});

function controlBtnStyle(active: boolean) {
  return {
    padding: "0.5rem 1rem",
    background: active ? "rgba(139,197,63,.3)" : "rgba(255,255,255,.1)",
    border: `1.5px solid ${active ? "#8BC53F" : "rgba(255,255,255,.3)"}`,
    color: "#fff",
    borderRadius: "8px",
    fontSize: "0.8rem",
    fontWeight: "500",
    cursor: "pointer",
  };
}
