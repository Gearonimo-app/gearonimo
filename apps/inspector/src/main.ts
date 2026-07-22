import { createApp, watch } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHistory } from "vue-router";
import { registerSW } from "virtual:pwa-register";
import "./style.css";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import { useAuth, supabase } from "@gearonimo/core";
import { initialLocale } from "@gearonimo/ui";
import { ensureInspector } from "./composables/useInspections";

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
  // Onthouden voorkeur (LangToggle in de kopbalk), anders de browsertaal.
  locale: initialLocale(),
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
      // Vóór /inspections/:id declareren zou niet eens hoeven (vue-router
      // matcht statisch boven params), maar zo staat het er duidelijk.
      path: "/inspections/new",
      component: () => import("./pages/InspectionNew.vue"),
      meta: { requiresAuth: true },
    },
    // Oude enkelvoud-route (vóór de URL-consistentieronde 2026-07-03).
    { path: "/inspection/new", redirect: "/inspections/new" },
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
      path: "/requests",
      component: () => import("./pages/Requests.vue"),
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
    {
      // Landt hier vanuit de reset-wachtwoord-e-mail; geen requiresAuth
      // (de tijdelijke recovery-sessie is er al door detectSessionInUrl,
      // maar dit is bewust los van de normale keurmeester-gate).
      path: "/reset-password",
      component: () => import("./pages/ResetPassword.vue"),
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
    // Query meenemen (o.a. ?email= uit een uitnodiging) zodat het inlogscherm
    // het e-mailadres alvast kan invullen.
    return { path: "/login", query: to.query };
  }
  // Klant-account op dit domein (gedeelde sessie met /portal/): alleen het
  // hoofdmenu mag getoond worden (die toont zelf de melding + link naar
  // /portal/). Zonder deze check kon een klant-account via een directe URL
  // of de terug-knop toch bij /customers, /settings, /import etc. komen --
  // RLS blokkeerde de dáta al, maar de schermen zelf bleven bereikbaar
  // (gemeld door Jos, 2026-07-05).
  if (to.meta.requiresAuth && to.path !== "/" && isLoggedIn.value) {
    try {
      await ensureInspector();
    } catch {
      // Platform-admin zonder keurmeester-rij (besluit Jos 2026-07-19:
      // platformbeheer los van elk keurbedrijf) mag wél naar Instellingen
      // (Bedrijven/Hero/Catalogus); de rest blijft keurmeester-terrein.
      if (to.path === "/settings" && (await isPlatformAdminOnce())) {
        return;
      }
      return "/";
    }
  }
});

// Cache per sessie zodat de guard niet bij elke navigatie een RPC doet;
// leeggemaakt bij elke auth-wissel (alleen een variabele resetten -- géén
// supabase-aanroep in de callback, zie CLAUDE.md-landmijn).
let platformAdminCached: boolean | null = null;
supabase.auth.onAuthStateChange(() => {
  platformAdminCached = null;
});
async function isPlatformAdminOnce(): Promise<boolean> {
  if (platformAdminCached === null) {
    const { data } = await supabase.rpc("is_platform_admin");
    platformAdminCached = !!data;
  }
  return platformAdminCached;
}

// Zelfherstel bij een verouderde lazy-chunk na een deploy: de pagina's worden
// lui geladen (import()), met een gehashte bestandsnaam. Na een nieuwe deploy
// bestaat die oude naam niet meer, dus een klik op een tegel kan stil falen
// ("navigatie doet niets") tot de service worker zichzelf heeft bijgewerkt.
// Vangt die importfout op en herlaadt één keer de doel-URL zodat de verse
// index + chunks geladen worden. De sessionStorage-vlag voorkomt een lus;
// hij wordt na een geslaagde navigatie weer gewist.
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

createApp(App).use(i18n).use(router).mount("#app");
