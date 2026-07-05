# NPM Package Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the jellyfish demo subsystem, split this repo into a publishable library (`src/`) and a runnable demo app (`examples/`), and configure it to publish as `react-three-water-caustics`.

**Architecture:** `src/` becomes the tsup-built library entry (water caustics provider/hook/shaders/effect only). `examples/` becomes a Vite app that consumes the library via a `@` path alias (resolves to `src/`) so the demo exercises the exact same public API a real consumer would import. Library code and demo code are never mixed in the same directory again.

**Tech Stack:** React 19, Three.js, @react-three/fiber, @react-three/postprocessing, Vite (examples), tsup (library build), TypeScript.

## Global Constraints

- Package name: `react-three-water-caustics` (spec: docs/superpowers/specs/2026-07-05-npm-package-design.md).
- Peer dependencies: `react` >=18, `three` >=0.150, `@react-three/fiber` >=8, `@react-three/postprocessing` >=2.
- `postprocessing` (bare package, used directly by `WaterDropEffect`) must also be an optional peer dependency and a build `external` — it is not part of `@react-three/postprocessing`'s public export surface, it's a separate npm package.
- No test runner exists in this repo (no vitest/jest configured) and this plan does not add one — it is out of scope for a structural migration. Every task is verified by running the actual build/dev commands (`tsc --noEmit`, `npm run build`, `npm run build:demo`) instead of unit tests.
- Library source (`src/`) must never import from `examples/`. Examples import the library only via the `@` alias (`@/water-caustics`, `@/index`), never via deep relative paths like `../../src/...`.
- File naming: library files stay kebab-case (already are). Demo component files move to kebab-case (`caustics-pool.tsx`, etc.) per spec's `examples/components/` listing.

---

### Task 1: Remove the jellyfish subsystem and other dead files

**Files:**
- Delete: `src/jellyfish/` (entire directory)
- Delete: `src/components/SwimmingJellyfish.tsx`
- Delete: `src/components/Particles.tsx` (only consumer was `SwimmingJellyfish.tsx`)
- Delete: `src/env.d.ts` (only declared `*.frag?raw` / `*.vert?raw` / `*.glsl?raw` modules, only used by jellyfish GLSL imports)
- Modify: `src/experience.tsx`

**Interfaces:**
- Produces: `src/experience.tsx` with no jellyfish references — later tasks (Task 4) rewrite this file further, so exact intermediate shape doesn't matter beyond "builds and renders".

- [ ] **Step 1: Delete jellyfish and dead files**

```bash
git rm -r src/jellyfish
git rm src/components/SwimmingJellyfish.tsx
git rm src/components/Particles.tsx
git rm src/env.d.ts
```

- [ ] **Step 2: Remove jellyfish import and usage from experience.tsx**

In `src/experience.tsx`, remove this import line:

```ts
import SwimmingJellyfish from "./components/SwimmingJellyfish";
```

And remove this line from the JSX (inside `<WaterCausticsProvider>`, after `<CausticsPool ... />`):

```tsx
        <SwimmingJellyfish />
```

- [ ] **Step 3: Verify the build still works**

Run: `npm run build`
Expected: Vite build completes with exit code 0, no "Could not resolve" errors referencing `jellyfish`, `SwimmingJellyfish`, or `Particles`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove jellyfish demo subsystem and dead code"
```

---

### Task 2: Fold WaterDropEffect into the library and add the `enableWaterDrop` toggle

**Files:**
- Move: `src/effects/WaterDropEffect.ts` → `src/water-caustics/water-drop-effect.ts` (content unchanged — file is self-contained, no relative imports)
- Modify: `src/water-caustics/index.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `WaterCausticsContextValue` now includes `enableWaterDrop: boolean`, readable via `useWaterCaustics()`. `WaterCausticsProviderProps` accepts `enableWaterDrop?: boolean` (default `true`). Later tasks (Task 4) read `useWaterCaustics().enableWaterDrop` in the demo's `Effects` component to decide whether to instantiate `WaterDropEffect`.

- [ ] **Step 1: Move the effect file**

```bash
mkdir -p src/water-caustics
git mv src/effects/WaterDropEffect.ts src/water-caustics/water-drop-effect.ts
rmdir src/effects 2>/dev/null || true
```

- [ ] **Step 2: Add `enableWaterDrop` to the context value interface**

In `src/water-caustics/index.tsx`, change:

```ts
interface WaterCausticsContextValue {
  uniforms: WaterCausticsUniforms;
  addDrop: (x: number, y: number, radius?: number, strength?: number) => void;
}
```

to:

```ts
interface WaterCausticsContextValue {
  uniforms: WaterCausticsUniforms;
  addDrop: (x: number, y: number, radius?: number, strength?: number) => void;
  enableWaterDrop: boolean;
}
```

- [ ] **Step 3: Add the prop to `WaterCausticsProviderProps` and destructure it with a default**

Change:

```ts
interface WaterCausticsProviderProps {
  children: ReactNode;
  position?: [number, number, number];
  size?: number;
  enableAutoDrops?: boolean;
  chromaticAberration?: number;
  waterSurfaceY?: number;
  depthColor?: string;
  depthDistance?: number;
  lightDir?: [number, number, number];
}

export function WaterCausticsProvider({
  children,
  position = [0, 0, 0],
  size = 10,
  enableAutoDrops = true,
  chromaticAberration = 0.005,
  waterSurfaceY = 5,
  depthColor = "#66e5ff",
  depthDistance = 5,
  lightDir = [0.667, 0.667, -0.333],
}: WaterCausticsProviderProps) {
```

to:

```ts
interface WaterCausticsProviderProps {
  children: ReactNode;
  position?: [number, number, number];
  size?: number;
  enableAutoDrops?: boolean;
  enableWaterDrop?: boolean;
  chromaticAberration?: number;
  waterSurfaceY?: number;
  depthColor?: string;
  depthDistance?: number;
  lightDir?: [number, number, number];
}

export function WaterCausticsProvider({
  children,
  position = [0, 0, 0],
  size = 10,
  enableAutoDrops = true,
  enableWaterDrop = true,
  chromaticAberration = 0.005,
  waterSurfaceY = 5,
  depthColor = "#66e5ff",
  depthDistance = 5,
  lightDir = [0.667, 0.667, -0.333],
}: WaterCausticsProviderProps) {
```

- [ ] **Step 4: Pass `enableWaterDrop` through the memoized context value**

Change:

```ts
  const contextValue = useMemo(
    () => ({ uniforms, addDrop }),
    [uniforms, addDrop],
  );
```

to:

```ts
  const contextValue = useMemo(
    () => ({ uniforms, addDrop, enableWaterDrop }),
    [uniforms, addDrop, enableWaterDrop],
  );
```

- [ ] **Step 5: Re-export `WaterDropEffect` from the water-caustics barrel**

At the top of `src/water-caustics/index.tsx`, add this export (near the other imports, e.g. right after the `useWaterSimulation` import):

```ts
export { WaterDropEffect } from "./water-drop-effect";
```

Without this, nothing outside `src/water-caustics/` can reach `WaterDropEffect` except by deep-importing `./water-caustics/water-drop-effect` directly — Task 4's `examples/experience.tsx` imports it from `@/water-caustics`, so it must be re-exported here.

- [ ] **Step 6: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: no errors (the only import of `src/effects/...` was `src/experience.tsx`, updated in Task 4; running this now will show one expected error there — confirm the error is exactly "Cannot find module './effects/WaterDropEffect'" and nothing else, then proceed — Task 4 fixes it).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: move WaterDropEffect into water-caustics lib, add enableWaterDrop toggle"
```

---

### Task 3: Add the library's public entry point

**Files:**
- Create: `src/index.ts`

**Interfaces:**
- Produces: the full public API surface re-exported from one file — `WaterCausticsProvider`, `useWaterCaustics`, `CausticsInteractionPlane`, the 6 public shaders (5 from the spec's list + `waterSurfaceVertexShader`, which the spec's export list omitted but which `examples/components/water-surface.tsx` needs — see spec gap note below), and `WaterDropEffect`.

**Note on spec gap:** the design doc's "Public API" section lists 5 shader exports but omits `waterSurfaceVertexShader`, even though the water surface demo component needs it and it only exists in the library's `shaders.ts`. Exporting it from `src/index.ts` closes that gap.

- [ ] **Step 1: Create `src/index.ts`**

```ts
export {
  WaterCausticsProvider,
  useWaterCaustics,
  CausticsInteractionPlane,
  WaterDropEffect,
} from "./water-caustics";

export {
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
  projectedTileCausticsFragmentShader,
  waterSurfaceVertexShader,
} from "./water-caustics/shaders";
```

- [ ] **Step 2: Verify it type-checks in isolation**

Run: `npx tsc --noEmit`
Expected: no errors reported for `src/index.ts` itself (the pre-existing `src/experience.tsx` error from Task 2 Step 5 is still expected here — it's fixed in Task 4).

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add src/index.ts public library entry point"
```

---

### Task 4: Restructure the demo app into `examples/`

**Files:**
- Create dir: `examples/components/`, `examples/pages/`
- Move+rename: `src/components/CameraController.tsx` → `examples/components/camera-controller.tsx`
- Move+rename: `src/components/CausticsPool.tsx` → `examples/components/caustics-pool.tsx`
- Move+rename: `src/components/CausticsSphere.tsx` → `examples/components/caustics-sphere.tsx`
- Move+rename: `src/components/CausticsTile.tsx` → `examples/components/caustics-tile.tsx`
- Move+rename: `src/components/WaterSurface.tsx` → `examples/components/water-surface.tsx`
- Move: `src/pages/LandingPage.tsx` → `examples/pages/LandingPage.tsx`
- Move: `src/experience.tsx` → `examples/experience.tsx` (rewritten — see Step 7)
- Move: `src/App.tsx` → `examples/App.tsx`
- Move: `src/index.jsx` → `examples/index.jsx`
- Move: `src/index.html` → `examples/index.html`
- Move: `src/style.css` → `examples/style.css`

**Interfaces:**
- Consumes: `@/water-caustics` and `@/water-caustics/shaders` (the `@` alias, wired up in Task 5, resolves to `src/`).
- Produces: `examples/experience.tsx` exports `default function Experience()`, unchanged signature, consumed by `examples/pages/LandingPage.tsx` exactly as before.

- [ ] **Step 1: Move and rename the caustics/camera components**

```bash
mkdir -p examples/components examples/pages
git mv src/components/CameraController.tsx examples/components/camera-controller.tsx
git mv src/components/CausticsPool.tsx examples/components/caustics-pool.tsx
git mv src/components/CausticsSphere.tsx examples/components/caustics-sphere.tsx
git mv src/components/CausticsTile.tsx examples/components/caustics-tile.tsx
git mv src/components/WaterSurface.tsx examples/components/water-surface.tsx
rmdir src/components 2>/dev/null || true
```

- [ ] **Step 2: Update imports in `examples/components/caustics-pool.tsx`**

Change:

```ts
import { useWaterCaustics } from "../water-caustics";
import {
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
} from "../water-caustics/shaders";
```

to:

```ts
import { useWaterCaustics } from "@/water-caustics";
import {
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
} from "@/water-caustics/shaders";
```

- [ ] **Step 3: Update imports in `examples/components/caustics-sphere.tsx`**

Change:

```ts
import { useWaterCaustics } from "../water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "../water-caustics/shaders";
```

to:

```ts
import { useWaterCaustics } from "@/water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "@/water-caustics/shaders";
```

- [ ] **Step 4: Update imports in `examples/components/caustics-tile.tsx`**

Change:

```ts
import { useWaterCaustics } from "../water-caustics";
import {
  projectedCausticsVertexShader,
  projectedTileCausticsFragmentShader,
} from "../water-caustics/shaders";
```

to:

```ts
import { useWaterCaustics } from "@/water-caustics";
import {
  projectedCausticsVertexShader,
  projectedTileCausticsFragmentShader,
} from "@/water-caustics/shaders";
```

- [ ] **Step 5: Update imports in `examples/components/water-surface.tsx`**

Change:

```ts
import { useWaterCaustics } from "../water-caustics";
import { waterSurfaceVertexShader } from "../water-caustics/shaders";
```

to:

```ts
import { useWaterCaustics } from "@/water-caustics";
import { waterSurfaceVertexShader } from "@/water-caustics/shaders";
```

`examples/components/camera-controller.tsx` needs no import changes (it only imports `react`, `@react-three/fiber`, `@react-three/drei`, `three-stdlib`).

- [ ] **Step 6: Move the page, app shell, and static entry files**

```bash
git mv src/pages/LandingPage.tsx examples/pages/LandingPage.tsx
rmdir src/pages 2>/dev/null || true
git mv src/App.tsx examples/App.tsx
git mv src/index.jsx examples/index.jsx
git mv src/index.html examples/index.html
git mv src/style.css examples/style.css
```

None of these four need import edits: `LandingPage.tsx` imports `../experience` (still one level up from `examples/pages/` to `examples/`), `App.tsx` imports `./pages/LandingPage` (still valid from `examples/`), `index.jsx` imports `./style.css` and `./App.tsx` (still valid), `index.html` references `./index.jsx` (still valid).

- [ ] **Step 7: Move and rewrite `experience.tsx`**

```bash
git mv src/experience.tsx examples/experience.tsx
```

Replace the full contents of `examples/experience.tsx` with:

```tsx
import { useEffect, useMemo } from "react";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  HueSaturationEffect,
} from "postprocessing";
import * as THREE from "three";
import { WaterCausticsProvider, useWaterCaustics, WaterDropEffect } from "@/water-caustics";
import CausticsPool from "./components/caustics-pool";
import WaterSurface from "./components/water-surface";
import CameraController from "./components/camera-controller";

function CameraInjector({ effect }: { effect: WaterDropEffect }) {
  const { camera } = useThree();
  useEffect(() => {
    effect.camera = camera;
    return () => {
      effect.camera = null;
    };
  }, [camera, effect]);
  return null;
}

function Effects() {
  const { enableWaterDrop } = useWaterCaustics();

  const effects = useMemo(() => {
    const base = {
      bloom: new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 0.8,
        luminanceSmoothing: 0.3,
        intensity: 1.5,
      }),
      chromatic: new ChromaticAberrationEffect(),
      hueSat: new HueSaturationEffect({ hue: 0, saturation: 0 }),
    };
    return enableWaterDrop
      ? { ...base, waterDrop: new WaterDropEffect() }
      : base;
  }, [enableWaterDrop]);

  useEffect(() => {
    return () => {
      Object.values(effects).forEach((effect) => effect.dispose());
    };
  }, [effects]);

  return (
    <>
      <EffectComposer>
        <primitive object={effects.bloom} dispose={null} />
        <primitive object={effects.chromatic} dispose={null} />
        <primitive object={effects.hueSat} dispose={null} />
        {effects.waterDrop && (
          <primitive object={effects.waterDrop} dispose={null} />
        )}
      </EffectComposer>
      {effects.waterDrop && <CameraInjector effect={effects.waterDrop} />}
    </>
  );
}

export default function Experience() {
  return (
    <>
      <CameraController />

      <Environment preset="sunset" />

      <WaterCausticsProvider
        position={[0, 0, 0]}
        size={10}
        enableAutoDrops={true}
        waterSurfaceY={4}
      >
        <WaterSurface position={[0, 4, 0]} />
        <CausticsPool
          position={[0, 0, 0]}
          size={10}
          wallHeight={5}
          tileRepeat={[1, 1]}
        />
        <Effects />
      </WaterCausticsProvider>
    </>
  );
}
```

This drops the unused `THREE` import along with jellyfish — the original file imported `* as THREE from "three"` but never used it directly (only via child components); removing the dead import here is intentional and matches the original's actual usage.

- [ ] **Step 8: Verify no source files remain directly under `src/` except the library**

Run: `find src -maxdepth 1 -type f -o -maxdepth 1 -type d`
Expected output: only `src/index.ts` and `src/water-caustics/` (as a file and a directory respectively — no `App.tsx`, `experience.tsx`, `index.jsx`, `index.html`, `style.css`, `components/`, `pages/`, `effects/`, `jellyfish/`, `env.d.ts`).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: move demo app into examples/, rename components to kebab-case"
```

---

### Task 5: Add build tooling and rewrite package.json

**Files:**
- Create: `tsup.config.ts`
- Create: `vite.examples.config.js`
- Delete: `vite.config.js` (superseded by `vite.examples.config.js`)
- Modify: `tsconfig.json`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run build` → runs `tsup`, emits `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`. `npm run dev` / `npm run build:demo` / `npm run preview` → operate on `examples/` via Vite, resolving `@/*` to `src/*`.

- [ ] **Step 1: Install `tsup` and the explicit `postprocessing` dependency**

```bash
npm install -D tsup postprocessing
```

`postprocessing` must be an explicit (dev)dependency because `src/water-caustics/water-drop-effect.ts` imports directly from it (`import { Effect } from "postprocessing"`) — it was previously only available transitively through `@react-three/postprocessing`.

- [ ] **Step 2: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  external: [
    'react',
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'postprocessing',
  ],
  sourcemap: true,
  clean: true,
})
```

`postprocessing` is added to `external` in addition to the spec's original list — without it, tsup would bundle the entire `postprocessing` package into `dist/index.js`, duplicating code the consumer already has via `@react-three/postprocessing`.

- [ ] **Step 3: Create `vite.examples.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: 'examples/',
  publicDir: '../static/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env)
  },
  build: {
    outDir: '../dist-demo',
    emptyOutDir: true,
    sourcemap: true
  },
  plugins: [react()]
})
```

The demo build output directory is `dist-demo`, not `dist` — `dist` is reserved for the library build (`tsup`'s output) so the two builds never collide or overwrite each other.

- [ ] **Step 4: Delete the old root Vite config**

```bash
git rm vite.config.js
```

- [ ] **Step 5: Add the `@` alias and examples to `tsconfig.json`**

Change:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.tsx"]
}
```

to:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.d.ts",
    "src/**/*.tsx",
    "examples/**/*.ts",
    "examples/**/*.tsx"
  ]
}
```

`baseUrl` is required for TypeScript to resolve the `paths` mapping — the original `tsconfig.json` declared `paths` without it, which meant the `@/*` alias silently did nothing before this task.

- [ ] **Step 6: Rewrite `package.json`**

Replace the full contents of `package.json` with:

```json
{
  "name": "react-three-water-caustics",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist", "README.md", "LICENSE"],
  "sideEffects": false,
  "scripts": {
    "dev": "vite --config vite.examples.config.js",
    "build": "tsup",
    "build:demo": "vite build --config vite.examples.config.js",
    "preview": "vite preview --config vite.examples.config.js",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18",
    "three": ">=0.150",
    "@react-three/fiber": ">=8",
    "@react-three/postprocessing": ">=2",
    "postprocessing": ">=6"
  },
  "peerDependenciesMeta": {
    "postprocessing": {
      "optional": true
    },
    "@react-three/postprocessing": {
      "optional": true
    }
  },
  "devDependencies": {
    "@react-three/drei": "^10.7.7",
    "@react-three/fiber": "^9.5.0",
    "@react-three/postprocessing": "^3.0.4",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "postprocessing": "^6.36.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "three": "^0.174.0",
    "three-custom-shader-material": "^6.4.0",
    "three-stdlib": "^2.35.0",
    "tsup": "^8.3.5",
    "typescript": "^5.9.3",
    "vite": "^6.2.2"
  }
}
```

`peerDependenciesMeta` marks `@react-three/postprocessing` and `postprocessing` optional since they're only required when the consumer keeps `enableWaterDrop` on (the default) — consumers who pass `enableWaterDrop={false}` and never import `WaterDropEffect` don't need them. `lil-gui`, `particulate`, `r3f-perf`, and `react-router-dom` are dropped — none were imported anywhere in `src/` or `examples/` (verified via `grep -rl` across the whole tree before this task). `three-stdlib` is added explicitly because `examples/components/camera-controller.tsx` imports a type from it directly.

- [ ] **Step 7: Install to sync the lockfile**

```bash
npm install
```

Expected: exits 0, `package-lock.json` updates to match the new `package.json`.

- [ ] **Step 8: Verify the library build**

Run: `npm run build`
Expected: exits 0. Then run `ls dist/` — expect `index.js`, `index.cjs`, `index.d.ts`, plus `.map` files for each.

- [ ] **Step 9: Verify the demo build**

Run: `npm run build:demo`
Expected: exits 0, no "Could not resolve" errors for `@/water-caustics` or any moved file. Then run `ls dist-demo/` — expect `index.html` and an `assets/` directory.

- [ ] **Step 10: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0, no errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "build: add tsup + examples Vite config, rewrite package.json for publishing"
```

---

### Task 6: Rewrite README for the published package

**Files:**
- Modify: `README.md`

**Interfaces:** none (documentation only).

- [ ] **Step 1: Replace the full contents of `README.md`**

```md
# react-three-water-caustics

Water caustics simulation for [React Three Fiber](https://docs.pmnd.rs/react-three-fiber). Provides an interactive, GPU-simulated water surface that projects realistic caustics onto arbitrary meshes, via a **Provider + Hook** pattern.

![Water Caustics Demo](static/water-caustics.gif)

## Features

- **Provider + Hook architecture** — `WaterCausticsProvider` runs the water simulation once; any descendant reads shared uniforms via `useWaterCaustics()`.
- **World-space projected caustics** — caustics project onto any mesh using world XZ coordinates, not just a single plane.
- **Interactive ripples** — `CausticsInteractionPlane` turns pointer move/down events into ripples and drops in the simulation.
- **Optional screen-space water drop effect** — `WaterDropEffect`, a `postprocessing` `Effect`, adds distortion when the camera crosses the water surface. Toggle with `enableWaterDrop`.
- **Shared uniform references** — the provider creates `{ value }` uniform objects once; consumers spread them into their own `ShaderMaterial`/`CustomShaderMaterial` instances and the provider's per-frame mutation updates every consumer without each one needing its own `useFrame`.

## Install

```bash
npm install react-three-water-caustics
```

Peer dependencies: `react` >=18, `three` >=0.150, `@react-three/fiber` >=8. `@react-three/postprocessing` and `postprocessing` are only required if you use `WaterDropEffect` / leave `enableWaterDrop` at its default of `true`.

## Quick Start

```tsx
import { Canvas } from "@react-three/fiber";
import {
  WaterCausticsProvider,
  useWaterCaustics,
  CausticsInteractionPlane,
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
} from "react-three-water-caustics";

function CausticsFloor() {
  const { uniforms } = useWaterCaustics();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        vertexShader={poolCausticsVertexShader}
        fragmentShader={poolCausticsFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 3, 8] }}>
      <WaterCausticsProvider size={10} waterSurfaceY={4}>
        <CausticsFloor />
        <CausticsInteractionPlane />
      </WaterCausticsProvider>
    </Canvas>
  );
}
```

### `WaterCausticsProvider` props

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `[number, number, number]` | `[0, 0, 0]` | World position of the water volume. |
| `size` | `number` | `10` | Width/depth of the simulated water area. |
| `enableAutoDrops` | `boolean` | `true` | Periodically spawn ambient ripples. |
| `enableWaterDrop` | `boolean` | `true` | Enable the `WaterDropEffect` screen distortion when the camera crosses the water surface. |
| `chromaticAberration` | `number` | `0.005` | Chromatic aberration strength applied by the caustics shaders. |
| `waterSurfaceY` | `number` | `5` | World Y coordinate of the water surface plane. |
| `depthColor` | `string` | `'#66e5ff'` | Tint color applied with depth. |
| `depthDistance` | `number` | `5` | Distance over which `depthColor` fully applies. |
| `lightDir` | `[number, number, number]` | `[0.667, 0.667, -0.333]` | Normalized light direction used by the caustics shaders. |

## Run the Examples

```bash
git clone <repository-url>
cd react-three-water-caustics
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). The examples app (`examples/`) is a full demo scene — pool, projected caustics on a sphere and tile, water surface with pointer ripples, and the screen-space water drop effect — built entirely against the published public API.

## License

See [LICENSE](LICENSE).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for react-three-water-caustics package"
```
