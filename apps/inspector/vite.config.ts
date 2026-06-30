import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      // Precache dekt de hele app-shell, dus elke route laadt zelf vanuit
      // cache (zelfde idee als de 404->index.html-truc van GitHub Pages,
      // maar dan voor de service worker i.p.v. de Pages-server).
      workbox: {
        navigateFallback: "/index.html",
        // De publieke verificatiepagina werkt altijd online (RPC-call) en
        // hoort niet op de SPA-shell-fallback terug te vallen.
        navigateFallbackDenylist: [/^\/verify\//],
      },
      manifest: {
        name: "Gearonimo Pro",
        short_name: "Gearonimo",
        description: "Keurmeester-app van Gearonimo",
        lang: "nl",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#16a34a",
        icons: [
          { src: "/icons/icon.jpg", sizes: "192x192", type: "image/jpeg" },
          { src: "/icons/icon.jpg", sizes: "512x512", type: "image/jpeg" },
        ],
      },
    }),
  ],
});
