# GEMINI.md

This document provides an overview of the `r3f-drei-water-caustics-effect` project, intended to serve as instructional context for AI interactions.

## Project Overview

This project demonstrates a high-quality, interactive water caustics effect using **React Three Fiber (R3F)**. It features a dynamic water simulation that reacts to mouse movements and clicks, rendering realistic caustics with chromatic aberration over a textured surface.

**Key Features:**
*   **Interactive Water Simulation**: The water surface reacts to pointer movements and clicks, creating ripples and drops.
*   **Realistic Caustics Shader**: Custom GLSL shaders implement a caustics effect with support for chromatic aberration and dynamic animation.
*   **Texture Support**: Integrates standard PBR textures (Color, Normal, Roughness) for the underwater surface.
*   **Configurable Component**: The `WaterCaustics` component exposes props for easy customization.
*   **Performance Monitoring**: Integrated `r3f-perf` for performance tracking.

**Core Technologies:**
*   **React**: JavaScript library for building user interfaces.
*   **Three.js**: A JavaScript 3D library that makes it easier to display 3D graphics in the browser.
*   **React Three Fiber (@react-three/fiber)**: A React renderer for Three.js, allowing you to build 3D scenes with declarative React components.
*   **@react-three/drei**: A collection of useful helpers and abstractions for React Three Fiber.
*   **Vite**: A fast development build tool.

## Architecture and Key Components

The application follows a standard React/R3F structure:

*   **`src/App.jsx`**: The entry point of the React application, responsible for setting up the main `Canvas` for React Three Fiber.
*   **`src/Experience.jsx`**: Defines the main 3D scene within the R3F `Canvas`. It integrates `OrbitControls` for camera manipulation, `r3f-perf` for performance monitoring, an `ambientLight`, and the central `WaterCaustics` component.
*   **`src/WaterCaustics/index.jsx`**: This is the primary React component for the water caustics effect. It manages texture loading, creates the `THREE.ShaderMaterial` for rendering, handles user interactions (mouse move/click) to trigger water drops, and updates shader uniforms (like time and textures) within the R3F `useFrame` loop. It leverages the `useWaterSimulation` hook for the fluid dynamics.
*   **`src/WaterCaustics/shaders.js`**: Contains all the GLSL (OpenGL Shading Language) code for the various shaders used in the water simulation and caustics rendering. This includes vertex shaders, and fragment shaders for drops, wave propagation, normal calculation, and the final caustics effect with chromatic aberration.
*   **`src/WaterCaustics/useWaterSimulation.js`**: A custom React hook that encapsulates the off-screen fluid simulation logic. It uses WebGL render targets and a "ping-pong" buffer technique to simulate water ripples and wave propagation efficiently. It provides functions to `addDrop` to the simulation and `getTexture` to retrieve the current state of the water simulation as a texture, which is then fed into the main caustics shader.

## Building and Running

### Prerequisites

Ensure [Node.js](https://nodejs.org/) is installed.

### Installation

```bash
npm install
```

### Running Development Server

```bash
npm run dev
```

The application will typically be available at `http://localhost:5173`.

## Usage

The core of the effect is provided by the `WaterCaustics` component. It can be easily integrated into any React Three Fiber scene.

**Example Usage:**

```jsx
import { Canvas } from "@react-three/fiber";
import WaterCaustics from "./WaterCaustics";

export default function App() {
  return (
    <Canvas camera={{ position: [3, 2, 6] }}>
      <ambientLight intensity={0.5} />
      <WaterCaustics
        position={[0, 0, 0]}
        scale={10}
        enableMouseInteraction={true}
        enableAutoDrops={true}
      />
    </Canvas>
  );
}
```

**Key Props for `WaterCaustics` component:**

| Prop                     | Type        | Default     | Description                                 |
| :----------------------- | :---------- | :---------- | :------------------------------------------ |
| `position`               | `[x, y, z]` | `[0, 0, 0]` | Position of the water plane.                |
| `scale`                  | `number`    | `10`        | Scale of the water plane.                   |
| `enableMouseInteraction` | `boolean`   | `true`      | Enables/disables mouse interaction ripples. |
| `enableAutoDrops`        | `boolean`   | `true`      | Enables/disables automatic random drops.    |
| `tileRepeat`             | `[x, y]`    | `[4, 4]`    | Texture repetition count.                   |

## Development Conventions

The project adheres to modern React development practices with a strong emphasis on React Three Fiber paradigms:

*   **Functional Components & Hooks**: Utilizes functional components and React hooks for state management and side effects (`useState`, `useEffect`, `useRef`, `useMemo`, `useCallback`).
*   **Declarative 3D Scenes**: Scenes are built declaratively using R3F components.
*   **GLSL Shaders**: Complex visual effects like water simulation and caustics are implemented using custom GLSL shaders, demonstrating a deep integration with Three.js's rendering capabilities.
*   **`useFrame` Hook**: Animations and continuous updates are managed using R3F's `useFrame` hook for optimal performance within the Three.js render loop.
*   **Modular Structure**: Code is organized into logical modules, with a dedicated `WaterCaustics` directory for the core effect, separating component logic, shaders, and simulation hooks.
*   **Performance Awareness**: Integration of `r3f-perf` indicates consideration for performance profiling.
