// After `next build`: Next's static export writes per-segment prefetch data in folders
// (roadmap/__next.roadmap/__PAGE__.txt), but its client asks for the same file with dots
// (roadmap/__next.roadmap.__PAGE__.txt). On a static host those requests 404 and every
// navigation falls back to a slower full fetch. This writes a copy under the dotted name.
import { copyFile, readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = "out";
let copied = 0;

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith(".txt")) {
      const parts = relative(root, path).split(sep);
      const i = parts.findIndex((p, n) => p.startsWith("__next.") && n < parts.length - 1);
      if (i === -1) continue;
      const flat = parts.slice(i).join(".");
      await copyFile(path, join(root, ...parts.slice(0, i), flat));
      copied++;
    }
  }
}

await walk(root);
console.log(`flatten-segments: ${copied} prefetch files copied to their dotted names`);
