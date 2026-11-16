import type { NextConfig } from "next";

/**
 * Schemata is a static site: every page is written to out/ at build time and
 * Postgres (PGlite) runs in the browser, so Netlify only serves files.
 */
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // `npm run typecheck` (tsc 7) checks types; Next's own checker expects the TypeScript 5 API.
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
};

export default config;
