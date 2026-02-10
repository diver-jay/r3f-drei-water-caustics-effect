import { OrbitControls, Environment } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { WaterCausticsProvider } from "./water-caustics";
import CausticsPool from "./components/CausticsPool";
import WaterSurface from "./components/WaterSurface";

export default function Experience() {
  return (
    <>
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ambientLight intensity={0.5} />
      <Environment preset="sunset" />

      <WaterCausticsProvider position={[0, 0, 0]} size={10} enableAutoDrops>
        <WaterSurface position={[0, 5, 0]} />
        <CausticsPool position={[0, 0, 0]} size={10} wallHeight={5} tileRepeat={[1, 1]} />
      </WaterCausticsProvider>
    </>
  );
}
