// Writes out/sw.js after `next build`: precaches every page, script, font and Postgres's
// WebAssembly, so Schemata works offline after the first visit. Netlify serves pages
// without ".html" (questions/x.html at /questions/x), so the precache uses those URLs.
import { generateSW } from "workbox-build";

const { count, size, warnings } = await generateSW({
  globDirectory: "out",
  globPatterns: ["**/*.{html,txt,js,css,json,svg,png,ico,woff2,wasm,data,webmanifest}"],
  globIgnores: [
    "sw.js",
    "workbox-*.js",
    "404.html",
    "_not-found*",
    "_not-found/**",
    // The bundler's copy of PGlite's files; the app loads them from /pglite/ instead (db/engine.ts).
    "_next/static/media/pglite*",
    "_next/static/media/initdb*",
    // Turbopack's worker loader reads its settings from the URL's #fragment, which a cached
    // response loses; it is tiny, so it always comes from the network (Monaco's worker chunks
    // themselves are precached, and offline Monaco falls back to the main thread).
    "_next/static/chunks/turbopack-worker-*.js",
  ],
  swDest: "out/sw.js",
  // Monaco and Postgres are large; they are precached so the editor works offline.
  maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
  // Next's hashed files never change; everything else is checked by revision.
  dontCacheBustURLsMatching: /^\/_next\/static\//,
  // /playground?dataset=x is the same page as /playground; Next adds ?_rsc=… to page data.
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
  modifyURLPrefix: { "": "/" },
  manifestTransforms: [
    async (entries) => ({
      manifest: entries.map((e) => ({
        ...e,
        url: e.url === "/index.html" ? "/" : e.url.replace(/\/index\.html$/, "/").replace(/\.html$/, ""),
      })),
      warnings: [],
    }),
  ],
  runtimeCaching: [
    {
      // Open-source datasets (Chinook, Northwind) fetched from GitHub on first use.
      urlPattern: /^https:\/\/raw\.githubusercontent\.com\//,
      handler: "CacheFirst",
      options: { cacheName: "datasets", expiration: { maxEntries: 20 } },
    },
  ],
});
for (const w of warnings) console.warn("service-worker:", w);
console.log(`service-worker: ${count} files precached (${(size / 1024 / 1024).toFixed(1)} MB)`);
