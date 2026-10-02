/**
 * public/icon.svg → PNG sizes for favicon / PWA / previews.
 * Run: node scripts/generate-app-icons.mjs
 */
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "public/icon.svg");
const outDir = join(root, "public/icons");
const appDir = join(root, "app");

mkdirSync(outDir, { recursive: true });

const svg = readFileSync(svgPath);

const sizes = [
  { file: join(outDir, "icon-192.png"), size: 192 },
  { file: join(outDir, "icon-512.png"), size: 512 },
  { file: join(outDir, "icon-preview-48.png"), size: 48 },
  { file: join(outDir, "icon-preview-96.png"), size: 96 },
  { file: join(appDir, "icon.png"), size: 32 },
  { file: join(appDir, "apple-icon.png"), size: 180 },
  { file: join(outDir, "favicon-32.png"), size: 32 },
];

for (const { file, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(file);
  console.log(`wrote ${file} (${size}px)`);
}
