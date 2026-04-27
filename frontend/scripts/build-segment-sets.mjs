/**
 * Scans `public/models/segments/<subdir>/*.obj` and writes `src/data/segmentSets.json`.
 * Run: `npm run build-segment-sets` (also runs in prebuild).
 */
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const segmentsRoot = join(root, 'public/models/segments');
const outFile = join(root, 'src/data/segmentSets.json');
const outDir = dirname(outFile);

const sets = {};
if (fs.existsSync(segmentsRoot)) {
  for (const ent of fs.readdirSync(segmentsRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const id = ent.name;
    if (id.startsWith('.')) continue;
    const dir = join(segmentsRoot, id);
    const names = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.obj'))
      .map((f) => f.slice(0, -4))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    sets[id] = names;
  }
}

if (Object.keys(sets).length === 0) {
  // CI (e.g. Vercel) clones without `public/models/segments/` (gitignored). Do not
  // overwrite the committed manifest — that would ship an empty list and break the viewer.
  if (fs.existsSync(outFile)) {
    console.warn(
      'build-segment-sets: no local .obj under public/models/segments — keeping existing src/data/segmentSets.json'
    );
    process.exit(0);
  }
  console.warn('build-segment-sets: no segments and no existing JSON — writing empty frednonopti');
  sets.frednonopti = [];
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(sets, null, 2) + '\n');
const sizes = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.length]));
console.log('build-segment-sets: sets', Object.keys(sets).length, 'sizes', sizes);
