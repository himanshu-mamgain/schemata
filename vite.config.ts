import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";
import { TOPICS } from "./src/content/topics.ts";

// Monaco's ESM sources, reached directly so we import only the parts we use (as DSA Atlas does).
const monacoEsm = fileURLToPath(new URL("./node_modules/monaco-editor/esm/vs", import.meta.url));

/** Publishes /topics.json so DSA Atlas and Structura can link to Schemata topics. */
function topicsJson(): Plugin {
  return {
    name: "schemata-topics-json",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "topics.json", source: JSON.stringify(TOPICS) });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    topicsJson(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Monaco and Postgres (WASM) are large; they are precached so the app works offline.
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,ttf,wasm,data,json}"],
        runtimeCaching: [
          {
            // Open-source datasets (Chinook, Northwind…) fetched from GitHub on first use.
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\//,
            handler: "CacheFirst",
            options: { cacheName: "datasets", expiration: { maxEntries: 20 } },
          },
        ],
      },
      manifest: {
        name: "Schemata",
        short_name: "Schemata",
        description: "Learn databases: a real Postgres SQL editor, interview questions, roadmap and a guide to every database.",
        theme_color: "#0a0e1a",
        background_color: "#0a0e1a",
        display: "standalone",
        start_url: "/",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
      },
    }),
  ],
  resolve: { alias: [{ find: /^monaco-esm\//, replacement: monacoEsm + "/" }] },
  // PGlite ships its own WASM; Vite must not pre-bundle it.
  optimizeDeps: { exclude: ["@electric-sql/pglite"] },
  worker: { format: "es" },
});
