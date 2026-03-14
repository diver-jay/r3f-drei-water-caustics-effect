import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { BloomEffect, ChromaticAberrationEffect, HueSaturationEffect } from "postprocessing";
import type { RitualBridge, ColorName } from "./ritualTypes";
import { COLOR_TO_ROUTE } from "./ritualTypes";

const HUE_BY_COLOR: Record<ColorName, number> = {
  Coral: 0.08,
  Gold: 0.15,
  Emerald: -0.12,
};

// Camera offset from jellyfish position
const CAM_OFFSET = new THREE.Vector3(0, 1.2, 2.5);

// Smoothstep easing
function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

interface Props {
  bridge: RitualBridge;
  bloomEffect: BloomEffect;
  chromaticEffect: ChromaticAberrationEffect;
  hueSatEffect: HueSaturationEffect;
  onNavigate: (path: string) => void;
}

export default function RitualController({
  bridge,
  bloomEffect,
  chromaticEffect,
  hueSatEffect,
  onNavigate,
}: Props) {
  const { camera, controls } = useThree();

  const isActive = useRef(false);
  const elapsed = useRef(0);
  const navigateFired = useRef(false);
  const pendingColor = useRef<ColorName | null>(null);

  const startCamPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const targetCamPos = useRef(new THREE.Vector3());
  const targetControlsTarget = useRef(new THREE.Vector3());

  const onNavigateRef = useRef(onNavigate);
  onNavigateRef.current = onNavigate;

  useFrame((_, delta) => {
    // Detect new trigger
    if (!isActive.current && bridge.trigger !== null) {
      const { colorName, position } = bridge.trigger;
      bridge.trigger = null;

      isActive.current = true;
      elapsed.current = 0;
      navigateFired.current = false;
      pendingColor.current = colorName;

      // Record starting positions
      startCamPos.current.copy(camera.position);
      const orb = controls as unknown as OrbitControlsImpl | null;
      startTarget.current.copy(orb?.target ?? new THREE.Vector3(0, 2.5, 0));

      // Compute destination
      targetCamPos.current.copy(position).add(CAM_OFFSET);
      targetControlsTarget.current.copy(position);

      if (orb) orb.enabled = false;
    }

    if (!isActive.current) return;

    elapsed.current += Math.min(delta, 1 / 30);
    const t = elapsed.current;
    const orb = controls as unknown as OrbitControlsImpl | null;

    // 0 → 1.0s: camera lerp + chromatic + hue ramp
    if (t < 1.0) {
      const alpha = smoothstep(t / 1.0);
      camera.position.lerpVectors(startCamPos.current, targetCamPos.current, alpha);
      if (orb) {
        orb.target.lerpVectors(startTarget.current, targetControlsTarget.current, alpha);
        orb.update();
      }

      // ChromaticAberration ramp: 0 → 0.035
      const ca = alpha * 0.035;
      chromaticEffect.offset.set(ca, ca);

      // HueSaturation hue ramp
      if (pendingColor.current) {
        hueSatEffect.hue = alpha * HUE_BY_COLOR[pendingColor.current];
      }
    }

    // 0.65 → 1.0s: Bloom intensity ramp: 1.5 → 8.0
    if (t >= 0.65 && t < 1.0) {
      const bloomT = (t - 0.65) / 0.35;
      bloomEffect.intensity = 1.5 + bloomT * 6.5;
    }

    // 1.0s: fire navigate once
    if (t >= 1.0 && !navigateFired.current) {
      navigateFired.current = true;
      if (pendingColor.current) {
        onNavigateRef.current(COLOR_TO_ROUTE[pendingColor.current]);
      }
    }

    // 1.2s: cleanup (scene still alive briefly during whitefade)
    if (t >= 1.2) {
      isActive.current = false;
      elapsed.current = 0;
      bloomEffect.intensity = 1.5;
      chromaticEffect.offset.set(0, 0);
      hueSatEffect.hue = 0;
      if (orb) {
        orb.enabled = true;
        orb.target.set(0, 2.5, 0);
        orb.update();
      }
    }
  });

  return null;
}
