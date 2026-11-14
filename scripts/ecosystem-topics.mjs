// Refreshes src/data/structura-topics.json from the live Structura site (same as DSA Atlas does).
// Structura's topics.json has no CORS header, so the browser can't fetch it; we copy it at build time.
// If the download fails, the saved copy is kept.
import { readFile, writeFile } from "node:fs/promises";

const SOURCES = [{ url: "https://structura-web.netlify.app/topics.json", out: "../src/data/structura-topics.json" }];

for (const { url, out } of SOURCES) {
  const file = new URL(out, import.meta.url);
  const prev = await readFile(file, "utf8").catch(() => "[]");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const topics = (await res.json()).map(({ id, title, blurb }) => ({ id, title, blurb }));
    const next = JSON.stringify(topics, null, 2);
    if (prev.trim() !== next) await writeFile(file, next + "\n");
    console.log(`ecosystem-topics: ${topics.length} topics from ${url}${prev.trim() === next ? " (unchanged)" : " (updated)"}`);
  } catch (err) {
    console.warn(`ecosystem-topics: keeping the saved copy for ${url} (${err.message})`);
  }
}
