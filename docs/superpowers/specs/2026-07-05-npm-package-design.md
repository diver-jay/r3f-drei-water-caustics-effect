# react-three-water-caustics — NPM Package Design

**Date:** 2026-07-05

## Goal

1. Remove all Jellyfish/Medusa code from the repo (keep water caustics only).
2. Restructure into a publishable npm library with a runnable examples app.
3. Publish as `react-three-water-caustics`.

---

## Package Name

`react-three-water-caustics`

Follows `react-three-rapier` naming convention. Concise and searchable.

---

## Repo Structure

```
react-three-water-caustics/
├── src/                          ← npm library source (tsup builds this)
│   ├── water-caustics/
│   │   ├── index.tsx             (WaterCausticsProvider, useWaterCaustics, CausticsInteractionPlane)
│   │   ├── shaders.ts
│   │   ├── use-water-simulation.ts
│   │   └── water-drop-effect.ts
│   └── index.ts                  (re-exports all public API)
├── examples/                     ← vite dev app (not published)
│   ├── components/
│   │   ├── caustics-pool.tsx
│   │   ├── caustics-sphere.tsx
│   │   ├── caustics-tile.tsx
│   │   ├── water-surface.tsx
│   │   └── camera-controller.tsx
│   ├── pages/
│   │   └── LandingPage.tsx
│   ├── experience.tsx
│   ├── App.tsx
│   ├── index.jsx
│   ├── index.html
│   └── style.css
├── static/                       ← tile textures (tiles_color.jpg, etc.)
├── docs/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vite.examples.config.js
└── README.md
```

---

## Files to Delete

- `src/jellyfish/` — entire directory (GLSL, parts, shaders, build.js)
- `src/components/SwimmingJellyfish.tsx`
- `src/components/Particles.tsx`

---

## Public API (package exports)

```ts
// Core
export { WaterCausticsProvider } from './water-caustics'
export { useWaterCaustics } from './water-caustics'
export { CausticsInteractionPlane } from './water-caustics'

// Shaders (for custom mesh materials)
export {
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
  projectedTileCausticsFragmentShader,
} from './water-caustics/shaders'

// Post-processing
export { WaterDropEffect } from './water-caustics/water-drop-effect'
```

### WaterCausticsProvider props

```ts
interface WaterCausticsProviderProps {
  children: ReactNode
  position?: [number, number, number]    // default [0,0,0]
  size?: number                          // default 10
  enableAutoDrops?: boolean              // default true
  enableWaterDrop?: boolean              // default true — WaterDropEffect screen distortion
  chromaticAberration?: number           // default 0.005
  waterSurfaceY?: number                 // default 5
  depthColor?: string                    // default '#66e5ff'
  depthDistance?: number                 // default 5
  lightDir?: [number, number, number]    // default [0.667, 0.667, -0.333]
}
```

`enableWaterDrop={false}` disables the WaterDropEffect post-processing.

---

## Build Config

### tsup.config.ts

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  external: ['react', 'three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing'],
  sourcemap: true,
  clean: true,
})
```

### vite.examples.config.js

Serves `examples/` as the vite root for dev and demo builds.

---

## package.json (key fields)

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
    "preview": "vite preview --config vite.examples.config.js"
  },
  "peerDependencies": {
    "react": ">=18",
    "three": ">=0.150",
    "@react-three/fiber": ">=8",
    "@react-three/postprocessing": ">=2"
  }
}
```

---

## README Shape

```md
# react-three-water-caustics

Water caustics simulation for React Three Fiber.

## Install

npm install react-three-water-caustics

## Quick Start

(code example with WaterCausticsProvider + useWaterCaustics)

## Run Examples

git clone ...
npm install
npm run dev
```

---

## Peer Dependencies

| Package | Required |
|---------|----------|
| `react` | ≥18 |
| `three` | ≥0.150 |
| `@react-three/fiber` | ≥8 |
| `@react-three/postprocessing` | ≥2 (only if `enableWaterDrop` is used) |

`@react-three/postprocessing` is optional in practice — if `enableWaterDrop={false}`, it's not used.

---

## Migration Steps (implementation order)

1. Delete jellyfish files
2. Move `src/components/` caustics files → `examples/components/`
3. Move `src/effects/water-drop-effect.ts` → `src/water-caustics/water-drop-effect.ts`
4. Move demo app files (`experience.tsx`, `App.tsx`, etc.) → `examples/`
5. Rename files to kebab-case
6. Update `experience.tsx` — remove SwimmingJellyfish, remove jellyfish imports
7. Update `src/index.ts` — add all public exports
8. Add `tsup.config.ts`
9. Add `vite.examples.config.js`
10. Update `package.json`
11. Update `README.md`
