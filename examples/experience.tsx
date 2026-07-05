import { useEffect, useMemo } from "react";
import { Environment } from "@react-three/drei";
import { EffectComposer } from "@react-three/postprocessing";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  HueSaturationEffect,
} from "postprocessing";
import { WaterCausticsProvider } from "@/water-caustics";
import CausticsPool from "./components/caustics-pool";
import WaterSurface from "./components/water-surface";
import CameraController from "./components/camera-controller";

export default function Experience() {
  const effects = useMemo(
    () => ({
      bloom: new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 0.8,
        luminanceSmoothing: 0.3,
        intensity: 1.5,
      }),
      chromatic: new ChromaticAberrationEffect(),
      hueSat: new HueSaturationEffect({ hue: 0, saturation: 0 }),
    }),
    [],
  );
  useEffect(() => {
    return () => {
      Object.values(effects).forEach((effect) => effect.dispose());
    };
  }, [effects]);

  return (
    <>
      <CameraController />

      <Environment preset="sunset" />

      <WaterCausticsProvider
        position={[0, 0, 0]}
        size={10}
        enableWaterDrop={true}
        waterSurfaceY={4}
      >
        <WaterSurface position={[0, 4, 0]} />
        <CausticsPool
          position={[0, 0, 0]}
          size={10}
          wallHeight={5}
          tileRepeat={[1, 1]}
        />
      </WaterCausticsProvider>

      <EffectComposer>
        <primitive object={effects.bloom} dispose={null} />
        <primitive object={effects.chromatic} dispose={null} />
        <primitive object={effects.hueSat} dispose={null} />
      </EffectComposer>
    </>
  );
}
