import { createApp, watch } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import { useAuth } from "@gearonimo/core";

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "nl",
  fallbackLocale: "en",
  messages: { nl, en },
});

// Hash-history: de app staat onder /klant/ op GitHub Pages, en met
// hash-routes werken deeplinks zonder 404-truc en zonder dat de
// service worker van de inspector-app (scope /) ertussen kan komen.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: () => import("./pages/Home.vue") },
    { path: "/login", component: () => import("./pages/Login.vue") },
    { path: "/koppelen", component: () => import("./pages/Join.vue") },
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

createApp(App).use(i18n).use(router).mount("#app");
