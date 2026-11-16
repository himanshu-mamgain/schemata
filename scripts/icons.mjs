// Renders the app icons from public/favicon.svg: `npm run icons`. The PNGs are committed,
// so this only needs running when the icon changes.
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));
const out = new URL("../public/icons/", import.meta.url);
await mkdir(out, { recursive: true });

const plain = (size, file) => sharp(svg, { density: 512 }).resize(size, size).png().toFile(fileURLToPath(new URL(file, out)));

await plain(192, "icon-192.png");
await plain(512, "icon-512.png");

// Maskable and Apple icons: the artwork inset on a full-bleed background, so launchers can crop it.
const inset = async (size, pad, file) => {
  const inner = await sharp(svg, { density: 512 })
    .resize(size - pad * 2, size - pad * 2)
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#2f6f9f" } })
    .composite([{ input: inner, left: pad, top: pad }])
    .png()
    .toFile(fileURLToPath(new URL(file, out)));
};
await inset(512, 60, "maskable-512.png");
await inset(180, 10, "apple-touch-icon.png");
console.log("icons: written to public/icons/");
