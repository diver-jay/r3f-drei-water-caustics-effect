import { OrbitControls, Environment } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { WaterCausticsProvider } from "./water-caustics";
import CausticsPool from "./components/CausticsPool";
import WaterSurface from "./components/WaterSurface";
import RisingBubbles from "./components/RisingBubbles";

export default function Experience() {
  return (
    <>
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ambientLight intensity={0.5} />
      <spotLight
        position={[0, 10, 0]}
        intensity={2.5}
        angle={0.55}
        penumbra={0.2}
        decay={0}
        color="white"
      />
      <Environment preset="sunset" />

      <WaterCausticsProvider
        position={[0, 0, 0]}
        size={10}
        enableAutoDrops={false}
      >
        <WaterSurface position={[0, 5, 0]} />
        <CausticsPool
          position={[0, 0, 0]}
          size={10}
          wallHeight={5}
          tileRepeat={[1, 1]}
        />
        <RisingBubbles />
      </WaterCausticsProvider>
    </>
  );
}
