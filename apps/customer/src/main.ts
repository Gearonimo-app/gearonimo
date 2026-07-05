import { createApp, watch } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import { useAuth, supabase } from "@gearonimo/core";

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "nl",
  fallbackLocale: "en",
  messages: { nl, en },
});

// Hash-history: de app staat onder /portal/ op GitHub Pages, en met
// hash-routes werken deeplinks zonder 404-truc en zonder dat de
// service worker van de inspector-app (scope /) ertussen kan komen.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: () => import("./pages/Home.vue") },
    { path: "/login", component: () => import("./pages/Login.vue") },
    { path: "/start", component: () => import("./pages/Start.vue") },
    { path: "/join", component: () => import("./pages/Join.vue") },
    { path: "/request", component: () => import("./pages/Request.vue") },
    { path: "/members", component: () => import("./pages/Members.vue") },
    // Oude Nederlandstalige routes (vóór de hernoeming 2026-07-03).
    { path: "/koppelen", redirect: "/join" },
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
});

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
