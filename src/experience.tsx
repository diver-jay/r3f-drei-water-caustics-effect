import { OrbitControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import WaterCaustics from "./water-caustics";

export default function Experience() {
  return (
    <>
      <Perf position="top-left" />

      <OrbitControls makeDefault />

      <ambientLight intensity={0.5} />

      <WaterCaustics position={[0, 0, 0]} scale={10} />
    </>
  );
}
