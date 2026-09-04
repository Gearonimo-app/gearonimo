// Gedeeld lijn-iconen-component voor beide apps (vervangt de emoji op
// tegels en in kopbalken -- besluit Jos 2026-07-15, stijl "dun + rond",
// zie het goedgekeurde iconenvoorstel/artifact van die dag).
//
// Bewust een TS-render-component en geen .vue-bestand: packages/ui wordt
// als kale bron geimporteerd (main: src/index.ts) en een SFC zou van de
// consumerende app een extra compilatiestap vragen. De iconen zijn statische,
// vertrouwde strings (grotendeels op lucide/feather-vormen gebaseerd;
// gereedschapskist zelf getekend en visueel geverifieerd) -- innerHTML is
// hier dus veilig.
//
// Grootte: het svg-element heeft geen eigen width/height; de aanroepende
// component zet die via zijn eigen (scoped) class -- de class op <GIcon>
// landt op het svg-root-element.
import { defineComponent, h } from "vue";

const ICONS: Record<string, string> = {
  // Keuringen: klembord met vinkje
  inspections:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  // Klanten / medewerkers: personen
  customers:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  // Aanvragen: postbak
  requests:
    '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  // Offline downloads
  offline:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  // SN zoeken / Recall: vergrootglas
  search:
    '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  // Instellingen: tandwiel
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  // Mijn materiaal: gereedschapskist (zelf getekend + gerenderd/gecheckt)
  materials:
    '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><line x1="3" y1="13" x2="21" y2="13"/><rect x="10.5" y="12" width="3" height="2.4" rx="0.5"/>',
  // ─── Materiaalsoort-tegels in de klant-app (2026-08-04) ───
  // Klimmateriaal: veiligheidshelm (lucide `hard-hat`-vorm).
  //
  // De karabiner -- het beeldmerk van de app -- is vijf keer geprobeerd: smal
  // met brede opening, D-vorm met rechte rug, ring met uitgesproken poort,
  // peervorm, en touw-met-knoop. Alle varianten zijn gerenderd op de échte
  // weergavemaat van 26px; daar valt de snapper telkens weg en blijft er een
  // pil of een ei over. De helm houdt op die maat wél zijn silhouet (rand +
  // koepel + kruinlipje) en is niet te verwarren met de gereedschapskist
  // (Mijn materiaal) of het tandwiel (Instellingen).
  climbing:
    '<path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1z"/><path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M4 15v-3a6 6 0 0 1 6-6"/><path d="M14 6a6 6 0 0 1 6 6v3"/>',
  // Machines: kettingzaag -- motorblok met beugel, zaagblad schuin omhoog.
  //
  // Het schuine blad is de reden dat dit werkt: recht naast het blok leest
  // het als een hangslot met een stokje, schuin krijgt het de kenmerkende
  // kettingzaag-houding. Tanden zijn er bewust uit -- die werden op 26px een
  // bergketen. Tandwiel was al bezet door Instellingen.
  machines:
    '<rect x="2.5" y="9" width="7" height="7.5" rx="2"/><path d="M4.8 9V7.6a2 2 0 0 1 2-2h2.1"/><path d="m9.5 11.2 9.2-2.5a1.8 1.8 0 0 1 .9 3.5l-10.1 2.7z"/>',
  // Kleding: werkbroek. Bewust geen T-shirt (Jos 2026-08-04: "mag een broek of
  // schoen worden") -- de zaagbroek is hier het typische artikel, en een broek
  // is in deze set nergens mee te verwarren.
  clothing:
    '<path d="M6 3h12l.6 18h-4.2L12 11l-2.4 10H5.4z"/><path d="M6 7h12"/>',
  // Overig: pakket (lucide `package`-vorm) -- de restcategorie van de klant
  // (EHBO-koffer, brandblusser, APK).
  other:
    '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/><path d="m7.5 4.27 9 5.15"/>',
  // Certificaten: keurmerk/zegel met lint
  certificates:
    '<circle cx="12" cy="9" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
  // Keuring aanvragen: agenda met vinkje
  "calendar-check":
    '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="m9 16 2 2 4-4"/>',
  home:
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  back:
    '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  edit:
    '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  plus:
    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  // Sluiten (tabblad-kruisje)
  close:
    '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  // Vingerafdruk/Face ID-login (gebaseerd op de lucide "fingerprint"-vorm)
  fingerprint:
    '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  // Info: bolletje met i (lucide `info`-vorm) -- markeert dat er een
  // opmerking uit de catalogus bij een artikel staat, zonder die opmerking
  // zelf continu te tonen.
  info:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
};

export const GIcon = defineComponent({
  name: "GIcon",
  props: {
    name: { type: String, required: true },
  },
  setup(props) {
    return () =>
      h("svg", {
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        "stroke-width": 1.5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "aria-hidden": "true",
        innerHTML: ICONS[props.name] ?? "",
      });
  },
});
