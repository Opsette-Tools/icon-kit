import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/icon-kit/" : "/",
  server: {
    host: "::",
    port: 8118,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      manifest: false,
      workbox: {
        navigateFallback: "index.html",
        // og-image.png is only fetched by social scrapers from the live server,
        // never by the app — keep it out of the offline precache (it also
        // exceeds the 2 MiB precache limit and would fail the build).
        globIgnores: ["**/og-image.png"],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
}));
