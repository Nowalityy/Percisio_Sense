/**
 * Regenerates `SEGMENTS` in medicalColors.js from `public/models/segments/*.obj` basenames.
 * Run after adding or renaming segment files: `npm run sync-segments`
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Script lives in `frontend/scripts/` → project root is `frontend/`. */
const root = join(__dirname, '..');
const segDir = join(root, 'public/models/segments');
const medicalColorsPath = join(root, 'src/components/Viewer3D/medicalColors.js');

if (!fs.existsSync(segDir)) {
  console.log(
    `sync-segments-list: ${segDir} not found (models hosted on CDN) — skipping sync, using baked SEGMENTS list.`
  );
  process.exit(0);
}

const names = fs
  .readdirSync(segDir)
  .filter((f) => f.endsWith('.obj'))
  .map((f) => f.slice(0, -4))
  .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

const esc = (n) => n.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = names.map((n) => `  '${esc(n)}',`).join('\n');
let src = fs.readFileSync(medicalColorsPath, 'utf8');
if (!src.includes('export const SEGMENTS')) {
  console.error('sync-segments-list: unexpected file (no SEGMENTS):', medicalColorsPath);
  process.exit(1);
}
const segBlock = /export const SEGMENTS = \[[\s\S]*?\];/;
if (!segBlock.test(src)) {
  console.error('sync-segments-list: could not find export const SEGMENTS in medicalColors.js');
  process.exit(1);
}
const newBlock = `export const SEGMENTS = [\n${lines}\n];`;
const replaced = src.replace(segBlock, newBlock);
if (replaced === src) {
  console.log(`sync-segments-list: ${names.length} segments (already up to date).`);
  process.exit(0);
}
fs.writeFileSync(medicalColorsPath, replaced);
console.log(`sync-segments-list: ${names.length} segments written.`);
