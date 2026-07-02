import { createApp, watch } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHistory } from "vue-router";
import { registerSW } from "virtual:pwa-register";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import { useAuth, supabase } from "@gearonimo/core";

// Dev-only: maak de client bereikbaar in de DevTools-console om de sessie te
// inspecteren (await supabase.auth.getSession()). Wordt nooit meegebouwd in prod.
if (import.meta.env.DEV) {
  (window as Window & { supabase?: typeof supabase }).supabase = supabase;
}

// Zelf registreren i.p.v. de kale auto-injectie: die controleert niet actief
// op een nieuwe versie, waardoor een al geopende (geïnstalleerde) PWA na een
// deploy stil op de oude, gecachete versie kan blijven hangen totdat iemand
//'m toevallig een keer volledig afsluit en heropent. `immediate: true` +
// automatisch herladen bij een gevonden update lost dat op: de gebruiker
// hoeft niets te doen, de app haalt zichzelf in.
registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload();
  },
});

const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "nl",
  fallbackLocale: "en",
  messages: { nl, en },
});

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      component: () => import("./pages/Home.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/customers",
      component: () => import("./pages/Customers.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/offline",
      component: () => import("./pages/OfflineDownloads.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/customers/:id",
      component: () => import("./pages/CustomerDetail.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/articles/:id",
      component: () => import("./pages/ArticleDetail.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/inspection/new",
      component: () => import("./pages/InspectionNew.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/inspections",
      component: () => import("./pages/Inspections.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/serial-search",
      component: () => import("./pages/SerialSearch.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/settings",
      component: () => import("./pages/Settings.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/import",
      component: () => import("./pages/ImportCertificate.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/inspections/:id",
      component: () => import("./pages/InspectionWizard.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/sets/:id",
      component: () => import("./pages/SetDetail.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/verify/:token",
      component: () => import("./pages/VerifyCertificate.vue"),
    },
    {
      path: "/login",
      component: () => import("./pages/Login.vue"),
    },
  ],
});

// Wacht op de initiële sessie-load: de oude "if (loading) return true" liet
// tijdens het laden ELKE navigatie door, waardoor het hoofdmenu altijd eerst
// zonder login verscheen en het inlogscherm pas bij de volgende klik kwam
// (gemeld door Jos, 2026-07-02). Zelfde patroon als de klant-app.
router.beforeEach(async (to) => {
  const { isLoggedIn, loading } = useAuth();
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
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return "/login";
  }
});

createApp(App).use(i18n).use(router).mount("#app");
