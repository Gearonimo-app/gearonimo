import { createApp, watch } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHashHistory } from "vue-router";
import "./style.css";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import { useAuth, supabase } from "@gearonimo/core";
import { initialLocale } from "@gearonimo/ui";

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  // Onthouden voorkeur (LangToggle in de kopbalk), anders de browsertaal.
  locale: initialLocale(),
  fallbackLocale: "en",
  messages: { nl, en, fr, de },
});

// Hash-history: de app staat onder /portal/ op GitHub Pages, en met
// hash-routes werken deeplinks zonder 404-truc en zonder dat de
// service worker van de inspector-app (scope /) ertussen kan komen.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: () => import("./pages/Home.vue") },
    { path: "/materials", component: () => import("./pages/Materials.vue") },
    { path: "/materials/:id", component: () => import("./pages/ArticleDetail.vue") },
    { path: "/certificates", component: () => import("./pages/Certificates.vue") },
    { path: "/login", component: () => import("./pages/Login.vue") },
    { path: "/start", component: () => import("./pages/Start.vue") },
    { path: "/request", component: () => import("./pages/Request.vue") },
    { path: "/members", component: () => import("./pages/Members.vue") },
    // Oude Nederlandstalige routes (vóór de hernoeming 2026-07-03).
    // Oude links met een uitnodigingscode: codes zijn vervallen (2026-09-26).
    { path: "/join", redirect: "/start" },
    { path: "/koppelen", redirect: "/start" },
    { path: "/medewerkers", redirect: "/members" },
    // Vangnet: een onbekende hash (bv. restanten van een auth-redirect)
    // hoort nooit een leeg scherm op te leveren.
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

// Wacht op de initiële sessie-load (useAuth zet loading op false zodra
// Supabase de sessie uit localStorage heeft gelezen) -- anders flitst elke
// herlaad-actie eerst langs /login.
router.beforeEach(async (to) => {
  const { loading, isLoggedIn } = useAuth();
  if (loading.value) {
    await new Promise<void>((resolve) => {
      const stop = watch(loading, (l) => {
        if (!l) {
          stop();
          resolve();
        }
      });
    });
  }
  if (!isLoggedIn.value && to.path !== "/login") return "/login";
  if (isLoggedIn.value && to.path === "/login") return "/";
  if (isLoggedIn.value) await claimMembershipsOnce();
});

// Inloggen zonder codes (besluit Jos 2026-09-26): staat je bevestigde
// e-mailadres op de lijst Gebruikers van een bedrijf, dan koppelt
// claim_my_memberships() je account daaraan. Eén keer per ingelogd account
// per sessie, hier in de guard zodat elke ingang (ook een deeplink naar
// /materials) het meeneemt. Bewust níet in onAuthStateChange (zie CLAUDE.md:
// supabase-aanroepen daarbinnen laten de app hangen). Een fout hier mag de
// app niet blokkeren; Start.vue heeft een "Opnieuw proberen".
let claimedFor: string | null = null;
async function claimMembershipsOnce() {
  const uid = useAuth().user.value?.id ?? null;
  if (!uid || claimedFor === uid) return;
  claimedFor = uid;
  await supabase.rpc("claim_my_memberships");
}

// Zelfherstel bij een verouderde lazy-chunk na een deploy (zie de uitleg in
// de inspector-main.ts): vangt de importfout op en herlaadt één keer, zodat
// een klik op een tegel niet stil faalt tot de service worker is bijgewerkt.
router.onError((error, to) => {
  const msg = String((error as Error)?.message || "");
  const isChunkError =
    /dynamically imported module|module script failed|Failed to fetch dynamically imported/i.test(msg);
  if (!isChunkError) return;
  if (sessionStorage.getItem("chunkReload")) return;
  sessionStorage.setItem("chunkReload", "1");
  window.location.assign(to.fullPath);
});
router.afterEach(() => sessionStorage.removeItem("chunkReload"));

// De magic-link komt terug met de tokens in de hash
// (/portal/#access_token=...). De hash-router zou die als (onbestaande)
// route lezen -> wit scherm (gemeld door Jos, 2026-07-02). getSession()
// wacht tot supabase-js de tokens uit de URL heeft verwerkt en de hash
// heeft schoongemaakt; pas daarna mag de router de hash interpreteren.
async function bootstrap() {
  if (window.location.hash.includes("access_token=")) {
    await supabase.auth.getSession();
    // Voor de zekerheid: alles wat er nog aan auth-restanten in de hash
    // staat weghalen, zodat de router op een schone '/' start.
    if (window.location.hash.includes("access_token=")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }
  createApp(App).use(i18n).use(router).mount("#app");
}
void bootstrap();
