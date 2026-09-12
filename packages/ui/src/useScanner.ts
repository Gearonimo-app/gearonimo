// Gedeelde camera-scanner-logica (QR/DataMatrix/barcode) voor beide apps --
// besloten met Jos 2026-09-12, geinspireerd op `js/scanner.js` uit de oude
// KlimKeur Pro-app. Gebruikt html5-qrcode (getUserMedia onder de motorkap);
// dezelfde camera-controls als het origineel (continu-autofocus, macro-knop,
// zaklamp, zoom) omdat die daar niet voor de sier stonden -- zonder scherpe
// focus is een kleine DataMatrix-code niet leesbaar.
//
// Puur logica/state hier; de weergave zit in ScanButton.ts (zelfde opsplitsing
// als useFieldSuggest.ts + de aanroepende templates).
import { ref, shallowRef, nextTick } from "vue";
// Alleen het type statisch importeren (compile-time, geen bundle-gewicht).
// De echte library (met de zxing-decoder erin) is een paar honderd kB en
// mag niet in elke pagina-load meeliften -- zie de dynamic import() in
// open() hieronder. Eerste keer scannen duurt daardoor een fractie langer
// (download + cache door de service worker), maar elke andere pagina blijft
// licht. Vóór deze aanpassing landde html5-qrcode gewoon in de hoofdbundel
// (578kB -> 918kB, gemeten bij het bouwen) -- precies het soort fragiele
// bouwsel dat de werkafspraken willen voorkomen.
import type { Html5Qrcode as Html5QrcodeType } from "html5-qrcode";

// Losse camera-track-capabilities zijn (nog) geen onderdeel van lib.dom.d.ts.
interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  focusDistance?: { min?: number; max?: number; step?: number };
  zoom?: { min?: number; max?: number; step?: number };
  torch?: boolean;
}

export function useScanner() {
  const isOpen = ref(false);
  const error = ref<string | null>(null);
  const hasMacro = ref(false);
  const hasZoom = ref(false);
  const hasTorch = ref(false);
  const zoomMin = ref(1);
  const zoomMax = ref(1);
  const zoomStep = ref(0.1);
  const zoomValue = ref(1);
  const macroOn = ref(false);
  const torchOn = ref(false);

  const instance = shallowRef<Html5QrcodeType | null>(null);
  const lastResult = ref<string | null>(null);
  let onResult: ((text: string) => void) | null = null;

  function resetState() {
    hasMacro.value = false;
    hasZoom.value = false;
    hasTorch.value = false;
    macroOn.value = false;
    torchOn.value = false;
    zoomValue.value = 1;
    lastResult.value = null;
  }

  /** Start de camera. `elementId` is het DOM-element waar de video-preview
   * in gerenderd wordt (moet al in de DOM staan). */
  async function open(elementId: string, callback: (text: string) => void) {
    if (isOpen.value) return;
    error.value = null;
    resetState();
    onResult = callback;
    isOpen.value = true;

    let qr: Html5QrcodeType;
    try {
      // Lazy: dit haalt html5-qrcode (incl. zxing-decoder) pas op zodra de
      // gebruiker echt op het scan-knopje klikt.
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const formats = [
        Html5QrcodeSupportedFormats.DATA_MATRIX,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
      ];
      // Zeker weten dat de overlay (met het video-doelelement) al in de DOM
      // staat voordat Html5Qrcode ernaar zoekt.
      await nextTick();
      qr = new Html5Qrcode(elementId, { formatsToSupport: formats, verbose: false });
      instance.value = qr;

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
          // Kort de herkende tekst laten zien (zelfde bevestiging als het
          // origineel) voordat de overlay dichtgaat -- meteen wegklappen
          // voelt onbetrouwbaar aan ("heeft ie 'm wel gezien?").
          onResult?.(decodedText);
          lastResult.value = decodedText;
          setTimeout(() => close(), 700);
        },
        () => {
          // Geen code gevonden in dit frame -- negeren, dat is normaal.
        }
      );
      initCameraControls();
    } catch (e) {
      console.error("Scanner starten mislukt:", e);
      error.value = "unavailable";
      instance.value = null;
      isOpen.value = false;
    }
  }

  function initCameraControls() {
    const qr = instance.value;
    if (!qr) return;
    let caps: ExtendedTrackCapabilities;
    try {
      caps = qr.getRunningTrackCapabilities() as ExtendedTrackCapabilities;
    } catch (e) {
      console.warn("Camera capabilities niet beschikbaar:", e);
      return;
    }

    if (caps.focusMode?.includes("continuous")) {
      try {
        qr.applyVideoConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] });
      } catch (e) {
        console.warn("Continuous autofocus instellen mislukt:", e);
      }
    }

    hasMacro.value = !!caps.focusDistance;

    if (caps.zoom) {
      hasZoom.value = true;
      zoomMin.value = caps.zoom.min ?? 1;
      zoomMax.value = caps.zoom.max ?? 1;
      zoomStep.value = caps.zoom.step ?? 0.1;
      zoomValue.value = caps.zoom.min ?? 1;
    }

    hasTorch.value = !!caps.torch;
  }

  function setZoom(z: number) {
    zoomValue.value = z;
    try {
      instance.value?.applyVideoConstraints({ advanced: [{ zoom: z } as MediaTrackConstraintSet] });
    } catch (e) {
      console.warn("Zoom instellen mislukt:", e);
    }
  }

  function toggleMacro() {
    const qr = instance.value;
    if (!qr || !hasMacro.value) return;
    let caps: ExtendedTrackCapabilities;
    try {
      caps = qr.getRunningTrackCapabilities() as ExtendedTrackCapabilities;
    } catch {
      return;
    }
    const next = !macroOn.value;
    try {
      if (next) {
        qr.applyVideoConstraints({
          advanced: [{ focusMode: "manual", focusDistance: caps.focusDistance?.min } as MediaTrackConstraintSet],
        });
      } else {
        const mode = caps.focusMode?.includes("continuous") ? "continuous" : "single-shot";
        qr.applyVideoConstraints({ advanced: [{ focusMode: mode } as MediaTrackConstraintSet] });
      }
      macroOn.value = next;
    } catch (e) {
      console.warn("Focus mode wisselen mislukt:", e);
    }
  }

  function toggleTorch() {
    const qr = instance.value;
    if (!qr || !hasTorch.value) return;
    const next = !torchOn.value;
    try {
      qr.applyVideoConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      torchOn.value = next;
    } catch (e) {
      console.warn("Torch schakelen mislukt:", e);
    }
  }

  function close() {
    const qr = instance.value;
    isOpen.value = false;
    onResult = null;
    if (qr) {
      qr.stop()
        .then(() => qr.clear())
        .catch(() => {
          /* opruimen mag stil falen -- de overlay is al weg */
        });
    }
    instance.value = null;
    resetState();
  }

  return {
    isOpen,
    error,
    lastResult,
    hasMacro,
    hasZoom,
    hasTorch,
    zoomMin,
    zoomMax,
    zoomStep,
    zoomValue,
    macroOn,
    torchOn,
    open,
    close,
    setZoom,
    toggleMacro,
    toggleTorch,
  };
}
