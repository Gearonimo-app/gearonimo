import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  // De klant-app draait op hetzelfde GitHub Pages-domein als de
  // inspector-app, onder /klant/ (zie .github/workflows/deploy.yml). De
  // router gebruikt hash-history, dus deeplinks hebben geen 404-fallback of
  // service-worker-uitzonderingen nodig.
  base: "/klant/",
  plugins: [vue()],
});
