// Copies PGlite's WebAssembly and filesystem bundle into public/pglite/, so the browser
// loads them as plain files (and the service worker precaches them) whatever the bundler does.
import { copyFile, mkdir } from "node:fs/promises";

const from = new URL("../node_modules/@electric-sql/pglite/dist/", import.meta.url);
const to = new URL("../public/pglite/", import.meta.url);
await mkdir(to, { recursive: true });
for (const f of ["pglite.wasm", "initdb.wasm", "pglite.data"]) await copyFile(new URL(f, from), new URL(f, to));
console.log("pglite-assets: copied to public/pglite/");
