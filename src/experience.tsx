import { useMemo, useRef } from "react";
import { Environment } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { useFrame } from "@react-three/fiber";
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

const POOL_HALF = 5;   // size / 2
const POOL_MIN_Y = 0;
const POOL_MAX_Y = 5;  // wallHeight

function PoolExitDetector({ effect }: { effect: WaterDropEffect }) {
  const wasInside = useRef(false);
  const phase = useRef<"idle" | "in" | "out">("idle");
  const phaseTime = useRef(0);
  const intensity = useRef(0);

  useFrame(({ camera }, delta) => {
    const { x, y, z } = camera.position;
    const isInside =
      Math.abs(x) < POOL_HALF &&
      Math.abs(z) < POOL_HALF &&
      y > POOL_MIN_Y &&
      y < POOL_MAX_Y;

    if (wasInside.current && !isInside) {
      phase.current = "in";
      phaseTime.current = 0;
    }
    wasInside.current = isInside;

    const dt = Math.min(delta, 1 / 30);

    if (phase.current === "in") {
      phaseTime.current += dt;
      intensity.current = Math.min(1, phaseTime.current / 0.3);
      if (phaseTime.current >= 0.3) {
        phase.current = "out";
        phaseTime.current = 0;
      }
    } else if (phase.current === "out") {
      phaseTime.current += dt;
      intensity.current = Math.max(0, 1 - phaseTime.current / 2.5);
      if (phaseTime.current >= 2.5) {
        phase.current = "idle";
      }
    }

    effect.uniforms.get("uIntensity")!.value = intensity.current;
  });

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

      <PoolExitDetector effect={waterDropEffect} />

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
