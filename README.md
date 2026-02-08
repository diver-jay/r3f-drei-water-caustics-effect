# React Three Fiber Water Caustics Effect

This project demonstrates a high-quality, interactive water caustics effect utilizing **React Three Fiber (R3F)**. It features a dynamic water simulation that reacts to mouse movements and clicks, rendering realistic caustics with chromatic aberration over a textured surface.

![Water Caustics Demo](static/water-caustics.gif)

## Features

- **Interactive Water Simulation**: The water surface reacts to pointer movements and clicks, creating ripples and drops.
- **Realistic Caustics Shader**: Custom GLSL shaders implement a caustics effect with support for:
  - Chromatic Aberration for visual depth.
  - Bicubic filtering for smoother transitions.
  - Dynamic time-based animation.
- **Texture Support**: Integrates standard PBR textures (Color, Normal, Roughness) for the underwater surface.
- **Configurable Component**: The `WaterCaustics` component exposes props for easy customization (position, scale, interaction settings).
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

The core of the effect is encapsulated in the `WaterCaustics` component. You can easily import and use it in your R3F scene.

```jsx
import { Canvas } from "@react-three/fiber";
import WaterCaustics from "./WaterCaustics";

export default function App() {
  return (
    <Canvas camera={{ position: [3, 2, 6] }}>
      <ambientLight intensity={0.5} />

      {/* Add the water caustics effect */}
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

### Component Props

| Prop                     | Type        | Default     | Description                                 |
| ------------------------ | ----------- | ----------- | ------------------------------------------- |
| `position`               | `[x, y, z]` | `[0, 0, 0]` | Position of the water plane.                |
| `scale`                  | `number`    | `10`        | Scale of the water plane.                   |
| `enableMouseInteraction` | `boolean`   | `true`      | Enables/disables mouse interaction ripples. |
| `enableAutoDrops`        | `boolean`   | `true`      | Enables/disables automatic random drops.    |
| `tileRepeat`             | `[x, y]`    | `[4, 4]`    | Texture repetition count.                   |

## Controls

- **Mouse/Pointer Move**: Creates small ripples on the water surface.
- **Mouse/Pointer Click**: Creates larger water drops/ripples.
- **Orbit Controls**: Standard camera controls (Left Click to Rotate, Right Click to Pan, Scroll to Zoom).

## Project Structure

```
src/
├── App.jsx              # Main application entry
├── Experience.jsx       # R3F Scene setup
├── WaterCaustics/       # Core Effect Component
│   ├── index.jsx        # Component logic
│   ├── shaders.js       # Vertex and Fragment GLSL shaders
│   └── useWaterSimulation.js # Hook for fluid simulation logic
└── ...
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
