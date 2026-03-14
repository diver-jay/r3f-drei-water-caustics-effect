import { useEffect, useMemo } from "react";
import { Environment } from "@react-three/drei";
import { Perf } from "r3f-perf";
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
  const bloomEffect = useMemo(
    () =>
      new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 0.8,
        luminanceSmoothing: 0.3,
        intensity: 1.5,
      }),
    [],
  );

  const chromaticEffect = useMemo(
    () => new ChromaticAberrationEffect({ offset: new THREE.Vector2(0, 0) }),
    [],
  );

  const hueSatEffect = useMemo(
    () => new HueSaturationEffect({ hue: 0, saturation: 0 }),
    [],
  );

  const waterDropEffect = useMemo(() => new WaterDropEffect(), []);

  return (
    <>
      <Perf position="top-left" />
      <CameraController />

      <ambientLight intensity={0.5} />
      <spotLight
        position={[6.67, 10, -3.33]}
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
        <primitive object={bloomEffect} />
        <primitive object={chromaticEffect} />
        <primitive object={hueSatEffect} />
        <primitive object={waterDropEffect} />
      </EffectComposer>

      <CameraInjector effect={waterDropEffect} />

      <RitualController
        bridge={bridge}
        bloomEffect={bloomEffect}
        chromaticEffect={chromaticEffect}
        hueSatEffect={hueSatEffect}
        onNavigate={onNavigate}
      />
    </>
  );
}
