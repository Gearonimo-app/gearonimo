// Werk-tabbladen voor de keurmeester-app (wens Jos 2026-07-31): tijdens een
// keuring of het koppelen van artikelen moest je alles verlaten om even een
// klant toe te voegen of de catalogus te bekijken. Nu draait de app als een
// mini-browser: meerdere pagina's staan tegelijk open, elk met hun eigen
// (levende) staat, en je wisselt met de strook bovenin.
//
// Hoe het werkt
// -------------
// Er is nog steeds maar EEN <router-view>; alleen het actieve tabblad wordt
// getekend. De andere blijven in leven via <keep-alive> in App.vue. De sleutel
// waarop keep-alive cachet is `tabId|fullPath` -- dat is bewust:
//   * twee tabbladen op dezelfde pagina (bv. twee klanten naast elkaar)
//     krijgen elk een eigen instantie;
//   * binnen een tabblad naar een andere klant navigeren geeft een nieuwe
//     sleutel, dus een verse component (de pagina's lezen route.params een
//     keer bij setup -- zonder verse sleutel zou klant 2 de gegevens van
//     klant 1 tonen);
//   * terug binnen hetzelfde tabblad geeft dezelfde sleutel, dus de bewaarde
//     staat komt terug.
// Tabblad-ids worden nooit hergebruikt, dus een gesloten tabblad kan zijn oude
// staat niet per ongeluk terugkrijgen; die cache-regel valt vanzelf weg door
// de :max van keep-alive.
//
// De sleutel wordt ALLEEN in router.afterEach gezet, nooit rechtstreeks uit
// (activeId, route) berekend: anders bestaat er tijdens een navigatie een
// tussenstand met het nieuwe tabblad en het oude pad, en zou keep-alive daar
// een wegwerp-instantie voor aanmaken.
import { reactive, ref, computed } from "vue";
import type { Router } from "vue-router";

export type WorkTab = {
  /** Uniek en nooit hergebruikt -- basis van de keep-alive-sleutel. */
  id: string;
  /** Het fullPath dat dit tabblad op dit moment toont. */
  path: string;
  /** Paginatitel zoals AppHeader die meldt; null zolang die er nog niet is. */
  label: string | null;
  /** i18n-sleutel als terugval (Home heeft geen AppHeader, en tijdens laden). */
  fallbackKey: string;
};

/** Meer dan dit wordt op een telefoon onleesbaar en kost onnodig geheugen. */
export const MAX_TABS = 8;
/**
 * keep-alive-cache: ruimer dan MAX_TABS omdat binnen een tabblad bezochte
 * pagina's ook een regel kosten (terug binnen een tabblad houdt zo zijn staat).
 */
export const MAX_ALIVE = 20;

const STORE_KEY = "gearonimo.tabs.v1";

const tabs = reactive<WorkTab[]>([]);
const activeId = ref("");
const viewKey = ref("");
const enabled = ref(false);

let router: Router | null = null;

function newId(): string {
  return crypto.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

/** Route -> i18n-sleutel; langste/specifiekste patroon eerst. */
const FALLBACK_KEYS: [RegExp, string][] = [
  [/^\/$/, "tabs.fallback.home"],
  [/^\/customers\/[^/]+/, "tabs.fallback.customer"],
  [/^\/customers/, "home.tiles.customers"],
  [/^\/articles\/[^/]+/, "tabs.fallback.article"],
  [/^\/inspections\/new/, "home.tiles.newInspection"],
  [/^\/inspections\/[^/]+/, "tabs.fallback.inspection"],
  [/^\/inspections/, "home.tiles.inspections"],
  [/^\/sets\/[^/]+/, "tabs.fallback.set"],
  [/^\/serial-search/, "home.tiles.serialSearch"],
  [/^\/requests/, "home.tiles.requests"],
  [/^\/offline/, "home.tiles.offline"],
  [/^\/settings/, "home.tiles.settings"],
  [/^\/import/, "tabs.fallback.import"],
];

function fallbackKeyFor(path: string): string {
  return FALLBACK_KEYS.find(([re]) => re.test(path))?.[1] ?? "tabs.fallback.page";
}

function persist() {
  try {
    sessionStorage.setItem(
      STORE_KEY,
      JSON.stringify({ tabs: tabs.map((t) => ({ ...t })), activeId: activeId.value }),
    );
  } catch {
    // Privémodus / vol quotum: de strook werkt gewoon, alleen niet over een
    // herlaad heen. Geen reden om de app te laten struikelen.
  }
}

function restore(): boolean {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { tabs?: WorkTab[]; activeId?: string };
    const list = (saved.tabs ?? []).filter((t) => t && typeof t.id === "string" && typeof t.path === "string");
    if (!list.length) return false;
    tabs.splice(0, tabs.length, ...list.slice(0, MAX_TABS));
    activeId.value = tabs.some((t) => t.id === saved.activeId) ? (saved.activeId as string) : tabs[0].id;
    return true;
  } catch {
    return false;
  }
}

function makeTab(path: string): WorkTab {
  return { id: newId(), path, label: null, fallbackKey: fallbackKeyFor(path) };
}

function activeTab(): WorkTab | undefined {
  return tabs.find((t) => t.id === activeId.value);
}

/**
 * Zet het actieve tabblad en zorgt dat de router meekomt. Als de router al op
 * het juiste pad staat (twee tabbladen op dezelfde pagina, of het tabblad dat
 * net gesloten werd stond op hetzelfde pad) vuurt router.push geen afterEach,
 * dus dan zetten we de sleutel hier zelf.
 */
function activate(tab: WorkTab) {
  activeId.value = tab.id;
  if (router && router.currentRoute.value.fullPath !== tab.path) {
    router.push(tab.path);
    return;
  }
  viewKey.value = `${tab.id}|${tab.path}`;
  persist();
}

/** Opent een nieuw tabblad (standaard op het hoofdmenu) en springt erheen. */
export function openTab(path = "/"): boolean {
  if (tabs.length >= MAX_TABS) return false;
  const tab = makeTab(path);
  tabs.push(tab);
  activate(tab);
  return true;
}

/** Sluit een tabblad; het laatste tabblad blijft altijd staan. */
export function closeTab(id: string) {
  if (tabs.length <= 1) return;
  const i = tabs.findIndex((t) => t.id === id);
  if (i < 0) return;
  const wasActive = tabs[i].id === activeId.value;
  tabs.splice(i, 1);
  if (wasActive) {
    // Buurman rechts, anders de laatste -- zoals een browser dat doet.
    activate(tabs[Math.min(i, tabs.length - 1)]);
  } else {
    persist();
  }
}

export function selectTab(id: string) {
  if (id === activeId.value) return;
  const tab = tabs.find((t) => t.id === id);
  if (tab) activate(tab);
}

/** Het tabblad waarin een component op dít moment wordt opgebouwd. */
export function currentTabId(): string {
  return activeId.value;
}

/**
 * Door AppHeader aangeroepen zodat de strook de echte paginatitel toont
 * ("Klant Acme", "Keuring 12-03") in plaats van een routenaam. Elke pagina
 * gebruikt AppHeader (afspraak in CLAUDE.md), dus dit hoeft niet per pagina.
 *
 * Expliciet mét tabblad-id: een pagina die in een ACHTERGROND-tabblad ligt
 * blijft leven, dus zijn titel kan alsnog veranderen (klantnaam die binnenkomt
 * na het wisselen). Zonder id zou die titel op het verkeerde tabblad landen.
 */
export function setTabLabel(id: string, label: string | null) {
  const tab = tabs.find((t) => t.id === id);
  const clean = label && label.trim() ? label.trim() : null;
  if (!tab || tab.label === clean) return;
  tab.label = clean;
  persist();
}

/** Bij uitloggen: de tabbladen van de vorige gebruiker mogen niet blijven staan. */
export function resetTabs() {
  tabs.splice(0, tabs.length);
  activeId.value = "";
  viewKey.value = "";
  try {
    sessionStorage.removeItem(STORE_KEY);
  } catch {
    /* zie persist() */
  }
}

/**
 * Eenmalig aanroepen vanuit main.ts, direct na het maken van de router.
 * Houdt de strook gelijk met de router: navigeren binnen een tabblad vervangt
 * het pad van dat tabblad (browser-gedrag), een nieuw tabblad maak je met de
 * plus-knop.
 */
export function installTabs(r: Router) {
  router = r;
  r.afterEach((to) => {
    if (to.meta.noTabs) {
      enabled.value = false;
      // Uitgelogd (of sessie verlopen): niets van de vorige gebruiker bewaren.
      if (to.path === "/login") resetTabs();
      return;
    }
    enabled.value = true;
    if (!tabs.length && !restore()) {
      const tab = makeTab(to.fullPath);
      tabs.push(tab);
      activeId.value = tab.id;
    }
    const tab = activeTab() ?? tabs[0];
    activeId.value = tab.id;
    if (tab.path !== to.fullPath) {
      tab.path = to.fullPath;
      tab.label = null;
      tab.fallbackKey = fallbackKeyFor(to.path);
    }
    viewKey.value = `${tab.id}|${to.fullPath}`;
    persist();
  });
}

export function useTabs() {
  return {
    tabs,
    activeId: computed(() => activeId.value),
    viewKey: computed(() => viewKey.value),
    enabled: computed(() => enabled.value),
    canOpen: computed(() => tabs.length < MAX_TABS),
    openTab,
    closeTab,
    selectTab,
  };
}
