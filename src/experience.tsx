import { OrbitControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import {
  WaterCausticsProvider,
  CausticsInteractionPlane,
} from "./water-caustics";
import CausticsTile from "./components/CausticsTile";
import CausticsSphere from "./components/CausticsSphere";
import CausticsCube from "./components/CausticsCube";

export default function Experience() {
  return (
    <>
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ambientLight intensity={0.5} />

      <WaterCausticsProvider position={[0, 0, 0]} size={10} enableAutoDrops>
        <CausticsInteractionPlane />
        <CausticsTile position={[0, 0, 0]} scale={10} tileRepeat={[1, 1]} />
        <CausticsSphere position={[-2, 1, 0]} radius={0.8} color="#ff6b6b" />
        <CausticsCube position={[2, 0.75, 0]} size={1.5} color="#4ecdc4" />
      </WaterCausticsProvider>
    </>
  );
}
