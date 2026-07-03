import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // De klant-app draait op hetzelfde GitHub Pages-domein als de
  // inspector-app, onder /portal/ (zie .github/workflows/deploy.yml).
  // Engelstalige URL-afspraak (Jos 2026-07-03); /customer/ bewust vermeden
  // omdat dat één letter scheelt met /customers (klantbeheer Pro-app). De
  // router gebruikt hash-history, dus deeplinks hebben geen 404-fallback of
  // service-worker-uitzonderingen nodig.
  base: "/portal/",
  plugins: [vue()],
});
