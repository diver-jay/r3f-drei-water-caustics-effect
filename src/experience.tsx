import { useEffect, useMemo } from "react";
import { Environment } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import {
  BloomEffect,
  ChromaticAberrationEffect,
  HueSaturationEffect,
} from "postprocessing";
import * as THREE from "three";
import { WaterCausticsProvider } from "./water-caustics";
import CausticsPool from "./components/CausticsPool";
import WaterSurface from "./components/WaterSurface";
import SwimmingJellyfish from "./components/SwimmingJellyfish";
import CameraController from "./components/CameraController";
import RitualController from "./ritual/RitualController";
import type { RitualBridge } from "./ritual/ritualTypes";
import { WaterDropEffect } from "./effects/WaterDropEffect";

function CameraInjector({ effect }: { effect: WaterDropEffect }) {
  const { camera } = useThree();
  useEffect(() => {
    effect.camera = camera;
    return () => {
      effect.camera = null;
    };
  }, [camera, effect]);
  return null;
}

interface ExperienceProps {
  bridge: RitualBridge;
  onNavigate: (path: string) => void;
}

export default function Experience({ bridge, onNavigate }: ExperienceProps) {
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
      waterDrop: new WaterDropEffect(),
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
        enableAutoDrops={true}
        waterSurfaceY={4}
      >
        <WaterSurface position={[0, 4, 0]} />
        <CausticsPool
          position={[0, 0, 0]}
          size={10}
          wallHeight={5}
          tileRepeat={[1, 1]}
        />
        <SwimmingJellyfish bridge={bridge} />
      </WaterCausticsProvider>

      <EffectComposer>
        <primitive object={effects.bloom} dispose={null} />
        <primitive object={effects.chromatic} dispose={null} />
        <primitive object={effects.hueSat} dispose={null} />
        <primitive object={effects.waterDrop} dispose={null} />
      </EffectComposer>

      <CameraInjector effect={effects.waterDrop} />

      <RitualController
        bridge={bridge}
        bloomEffect={effects.bloom}
        chromaticEffect={effects.chromatic}
        hueSatEffect={effects.hueSat}
        onNavigate={onNavigate}
      />
    </>
  );
}
