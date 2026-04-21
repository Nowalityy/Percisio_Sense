# PROFILING_REPORT

## Scope

This report captures baseline and post-optimization profiling data for the frontend runtime and bundle.  
Instrumentation and optimizations were applied incrementally and validated with `npm run build`.

## Step 0 Instrumentation

- Added `stats.js` overlay + inline FPS/MB monitor in `Viewer3D`.
- Added `usePerformanceMonitor.ts` (dev FPS + memory logging).
- Added `performance.config.ts` for centralized tuning constants.

## Baseline Findings (before optimization pass)

### Build chunk sizes (from baseline build output)

- `dist/assets/index-LnsX7w4Y.css`: `53.28 kB` (`9.90 kB` gzip)
- `dist/assets/Chatbot-DCrUB_jF.js`: `31.47 kB` (`10.68 kB` gzip)
- `dist/assets/index-lL9IK5Qd.js`: `323.62 kB` (`103.59 kB` gzip)
- `dist/assets/Viewer3D-Bt_Ql5KQ.js`: `938.72 kB` (`256.64 kB` gzip)

### `npx vite-bundle-visualizer` output

Command attempted:

```bash
npx vite-bundle-visualizer --template raw-data --open false --output ./bundle-baseline.json
```

Observed output:

```text
TypeError: Cannot destructure property 'build' of '(intermediate value)' as it is undefined.
```

Status: tool incompatible with the current Vite runtime in this environment.

### Lighthouse baseline

Command attempted:

```bash
npx lighthouse http://localhost:5173 --quiet --chrome-flags='--headless=new --no-sandbox' --only-categories=performance --output=json --output-path=./lighthouse-baseline.json
```

Observed output:

```text
Unable to connect to Chrome
```

Status: blocked in this environment due to missing headless Chrome target for Lighthouse CLI.

### Heap Snapshot + React Profiler

- Chrome DevTools Heap Snapshot: **manual step required in local GUI browser**
- React DevTools 10s profile: **manual step required in local GUI browser**

These two artifacts cannot be captured from the current headless CLI environment.

## Optimizations Applied

### 3D / Rendering

- Added renderer teardown (`dispose` + `forceContextLoss`) on unmount.
- Added disposal hook for geometries/materials/textures (`useDispose.ts`).
- Enabled demand rendering (`frameloop="demand"`).
- Capped DPR (`MAX_DPR = 1.5`) and low-end antialias fallback.
- Enforced frustum culling for meshes.
- Disabled shadow map work for the medical scene.
- Added OrbitControls change throttling to ~60fps via RAF.
- Added segment filter debounce/throttle.

### React runtime

- Added memoization for expensive chat components.
- Added virtualization for long findings lists (>20 rows) using `react-window`.
- Added report parsing off-main-thread using Web Worker + `comlink`.
- Added leak detector hook (`FinalizationRegistry`) for dev diagnostics.

### API / Chat performance

- Added client response cache (last entries with TTL).
- Added request deduplication and “From cache” indicator.
- Added request queue (single in-flight pipeline).
- Added `AbortController` cancellation on new request + unmount.
- Added streaming-capable response path with incremental text rendering fallback.

### Bundling

- Added manual chunking in `vite.config.js` for `three` and `react`.
- Added lazy loading boundaries for heavy assistant sub-panels.

## Post-Optimization Metrics

### Build chunk sizes (after optimization pass)

- `dist/assets/index-C_guLFMa.css`: `54.20 kB` (`10.05 kB` gzip)
- `dist/assets/index-DkZk-wwX.js`: `129.59 kB` (`42.55 kB` gzip)
- `dist/assets/Chatbot-uhdp8SGi.js`: `34.58 kB` (`12.48 kB` gzip)
- `dist/assets/Viewer3D-iO8PpcpH.js`: `41.29 kB` (`13.76 kB` gzip)
- `dist/assets/three-iIj6ist-.js`: `1,102.60 kB` (`308.74 kB` gzip)

### Interpretation

- Main app shell payload is significantly reduced (`index` chunk dropped from ~323k to ~129k) due to chunk isolation.
- Three.js payload is now isolated in a dedicated chunk, improving cacheability and initial non-viewer load paths.
- Viewer-specific chunk is now lightweight because heavy runtime moved to the shared `three` chunk.

## Remaining Manual Validation (required on your machine)

1. Open Chrome DevTools > Memory > capture Heap Snapshot on app load and after 5 minutes interaction.
2. Open React DevTools Profiler > record a 10s interaction (rotate model + send chat + switch tabs).
3. Run Lighthouse from Chrome DevTools (not CLI in this environment) and capture before/after score.
4. Confirm target: >=20-point Lighthouse Performance improvement.

## Notes

- All implemented changes were build-validated after each optimization wave.
- No linter issues reported on modified files.
