import { Canvas } from "@react-three/fiber";
import Experience from "./experience";

export default function App() {
  return (
    <Canvas
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        position: [3, 2, 6],
      }}
    >
      <Experience />
    </Canvas>
  );
}
