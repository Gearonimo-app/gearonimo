import { createApp } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";
import { useAuth } from "./composables/useAuth";

const i18n = createI18n({
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
      path: "/customers/:id",
      component: () => import("./pages/CustomerDetail.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/login",
      component: () => import("./pages/Login.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  const { isLoggedIn, authReady } = useAuth();
  await authReady;
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return "/login";
  }
});

createApp(App).use(i18n).use(router).mount("#app");
