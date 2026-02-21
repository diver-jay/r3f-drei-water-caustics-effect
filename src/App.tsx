import { Canvas } from "@react-three/fiber";
import Experience from "./experience";

export default function App() {
  return (
    <Canvas
      style={{ background: "#000" }}
      camera={{
        fov: 45,
        near: 0.1,
        far: 200,
        position: [8, 12, 12],
      }}
    >
      <Experience />
    </Canvas>
  );
}
