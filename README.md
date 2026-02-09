# React Three Fiber Water Caustics Effect

This project demonstrates a high-quality, interactive water caustics effect utilizing **React Three Fiber (R3F)**. It features a dynamic water simulation that reacts to mouse movements and clicks, rendering realistic caustics with chromatic aberration on arbitrary meshes via a **Provider + Hook** pattern.

![Water Caustics Demo](static/water-caustics.gif)

## Features

- **Provider + Hook Architecture**: `WaterCausticsProvider` manages the water simulation, while child components consume shared uniforms via `useWaterCaustics()` hook.
- **World-Space Projected Caustics**: Caustics are projected onto any mesh using world XZ coordinates, not limited to a single plane.
- **Interactive Water Simulation**: A separate `CausticsInteractionPlane` component handles pointer events for creating ripples and drops.
- **Realistic Caustics Shader**: Custom GLSL shaders implement a caustics effect with support for:
  - Chromatic Aberration for visual depth.
  - Dynamic time-based animation.
  - Tile texture support with refraction distortion.
- **Shared Uniform References**: Provider creates `{ value }` uniform objects once. Consumers spread them into their ShaderMaterials — Provider mutates `.value` each frame, all consumers auto-update without their own `useFrame`.
- **Performance Monitoring**: Integrated `r3f-perf` for performance tracking.

## Tech Stack

- **[React](https://react.dev/)**
- **[Three.js](https://threejs.org/)**
- **[React Three Fiber](https://docs.pmnd.rs/react-three-fiber)**
- **[@react-three/drei](https://github.com/pmndrs/drei)**
- **[Vite](https://vitejs.dev/)** - For fast development and building.

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd r3f-drei-water-caustics-effect
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Running Development Server

Start the local development server:

```bash
npm run dev
```

Open your browser and navigate to the URL shown in the terminal (usually `http://localhost:5173`).

## Usage

The effect uses a **Provider + Hook** pattern. Wrap your scene with `WaterCausticsProvider`, then use `useWaterCaustics()` in consumer components to access shared uniforms.

### Basic Setup

```tsx
import { Canvas } from "@react-three/fiber";
import {
  WaterCausticsProvider,
  CausticsInteractionPlane,
  useWaterCaustics,
} from "./water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "./water-caustics/shaders";

export default function App() {
  return (
    <Canvas camera={{ position: [3, 2, 6] }}>
      <ambientLight intensity={0.5} />

      <WaterCausticsProvider position={[0, 0, 0]} size={10} enableAutoDrops>
        <CausticsInteractionPlane />
        <CausticsSphere />
        <CausticsCube />
      </WaterCausticsProvider>
    </Canvas>
  );
}
```

### Consumer Component Example

```tsx
import { useMemo } from "react";
import * as THREE from "three";
import { useWaterCaustics } from "./water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "./water-caustics/shaders";

function CausticsSphere() {
  const { uniforms } = useWaterCaustics();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms, // Spread shared uniforms (auto-updating references)
          baseColor: { value: new THREE.Color("#ff6b6b") }, // Mesh-specific uniform
        },
        vertexShader: projectedCausticsVertexShader,
        fragmentShader: projectedCausticsFragmentShader,
      }),
    [uniforms],
  );

  return (
    <mesh position={[-2, 1, 0]}>
      <sphereGeometry args={[0.8, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
```

### Tile Caustics (with textures + refraction)

For surfaces with PBR textures, use the `projectedTileCausticsFragmentShader` and add tile-specific uniforms:

```tsx
import { projectedTileCausticsFragmentShader } from "./water-caustics/shaders";

function CausticsTile() {
  const { uniforms } = useWaterCaustics();
  const [colorTex, normalTex, roughnessTex] = useLoader(THREE.TextureLoader, [
    "/tiles_color.jpg",
    "/tiles_normal.jpg",
    "/tiles_roughness.jpg",
  ]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          tileColor: { value: colorTex },
          tileNormal: { value: normalTex },
          tileRoughness: { value: roughnessTex },
          tileRepeat: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader: projectedCausticsVertexShader,
        fragmentShader: projectedTileCausticsFragmentShader,
        side: THREE.DoubleSide,
      }),
    [uniforms, colorTex, normalTex, roughnessTex],
  );

  return (
    <mesh rotation={[-Math.PI * 0.5, 0, 0]} scale={10}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
```

### WaterCausticsProvider Props

| Prop                  | Type        | Default     | Description                              |
| --------------------- | ----------- | ----------- | ---------------------------------------- |
| `position`            | `[x, y, z]` | `[0, 0, 0]` | World-space position of the water plane. |
| `size`                | `number`    | `10`        | Size of the water plane in world units.  |
| `enableAutoDrops`     | `boolean`   | `true`      | Enables automatic random drops.          |
| `chromaticAberration` | `number`    | `0.005`     | Chromatic aberration intensity.          |

### useWaterCaustics() Return Value

| Field     | Type                                          | Description                                       |
| --------- | --------------------------------------------- | ------------------------------------------------- |
| `uniforms` | `WaterCausticsUniforms`                       | Shared uniform references (auto-updated by Provider). |
| `addDrop`  | `(x, y, radius?, strength?) => void`          | Add a ripple at simulation coordinates (-1 to 1). |

### Shaders

| Shader                                | Description                                         |
| ------------------------------------- | --------------------------------------------------- |
| `projectedCausticsVertexShader`       | Passes world position to fragment for XZ projection. |
| `projectedCausticsFragmentShader`     | Generic caustics with `baseColor` uniform (vec3).    |
| `projectedTileCausticsFragmentShader` | Tile caustics with PBR textures + refraction.        |

## Controls

- **Mouse/Pointer Move**: Creates small ripples on the water surface (via `CausticsInteractionPlane`).
- **Mouse/Pointer Click**: Creates larger water drops/ripples.
- **Orbit Controls**: Standard camera controls (Left Click to Rotate, Right Click to Pan, Scroll to Zoom).

## Project Structure

```
src/
├── App.tsx                # Main application entry
├── experience.tsx         # Scene setup with Provider + consumer components
├── water-caustics/        # Core Effect Module
│   ├── index.tsx          # WaterCausticsProvider, useWaterCaustics, CausticsInteractionPlane
│   ├── shaders.ts         # GLSL shaders (simulation + projected caustics)
│   └── use-water-simulation.ts  # Hook for GPU-based fluid simulation
└── ...
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
