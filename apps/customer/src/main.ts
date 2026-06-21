import { createApp } from "vue";
import { createI18n } from "vue-i18n";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import nl from "./locales/nl.json";
import en from "./locales/en.json";

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
    },
    {
      path: "/login",
      component: () => import("./pages/Login.vue"),
    },
  ],
});

createApp(App).use(i18n).use(router).mount("#app");
