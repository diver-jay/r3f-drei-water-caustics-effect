import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWaterCaustics } from "../water-caustics";
import Jellyfish from "../jellyfish/Jellyfish";
import Particles from "./Particles";

const AFFINITY_PAIRS = [
  ["J1", "Coral"],
  ["J2", "Gold"],
  ["J3", "Emerald"],
] as const;

type ColorName = "Coral" | "Gold" | "Emerald";

const D_CONNECT = 3.0 * 0.55;
const D_MAX = 3.0 * 0.75;

const JELLIES = [
  {
    name: "J1",
    colors: {
      base: new THREE.Color("#d0e8ff"),
      dark: new THREE.Color("#a0c4ee"),
      glow: new THREE.Color("#ff6b6b"),
    },
    initial: { azimuth: 0.0, position: new THREE.Vector3(1.5, 1.4, 0.3) },
  },
  {
    name: "J2",
    colors: {
      base: new THREE.Color("#c8e0f8"),
      dark: new THREE.Color("#90b8e0"),
      glow: new THREE.Color("#ffd93d"),
    },
    initial: { azimuth: 2.6, position: new THREE.Vector3(0.2, 1.2, 1.8) },
  },
  {
    name: "J3",
    colors: {
      base: new THREE.Color("#e4f0ff"),
      dark: new THREE.Color("#b8d4f0"),
      glow: new THREE.Color("#6bcb77"),
    },
    initial: { azimuth: 5.2, position: new THREE.Vector3(1.0, 1.6, -1.4) },
  },
  {
    name: "Coral",
    colors: {
      base: new THREE.Color("#ff6b6b"),
      dark: new THREE.Color("#7a1a1a"),
      glow: new THREE.Color("#ff4444"),
    },
    initial: { azimuth: 0.7, position: new THREE.Vector3(1.5, 1.5, 0.5) },
    speed: 0.7,
    size: 1.5,
  },
  {
    name: "Gold",
    colors: {
      base: new THREE.Color("#ffd93d"),
      dark: new THREE.Color("#8b6b00"),
      glow: new THREE.Color("#ffcc00"),
    },
    initial: { azimuth: 2.1, position: new THREE.Vector3(-1.0, 1.8, -1.0) },
    speed: 0.7,
    size: 1.5,
  },
  {
    name: "Emerald",
    colors: {
      base: new THREE.Color("#6bcb77"),
      dark: new THREE.Color("#1a5c25"),
      glow: new THREE.Color("#44bb55"),
    },
    initial: { azimuth: 3.8, position: new THREE.Vector3(-0.5, 1.2, 1.5) },
    speed: 0.7,
    size: 1.5,
  },
];

const WHITE_JELLYFISH_IDS = ["J1", "J2", "J3"] as const;

export default function SwimmingJellyfish() {
  const positionsMapRef = useRef(new Map<string, THREE.Vector3>());
  const connectedRef = useRef(new Set<string>());

  const connectionGlowMap = useRef<Record<string, { value: number }>>(
    Object.fromEntries([
      ...WHITE_JELLYFISH_IDS.map((id) => [id, { value: 0 }]),
      ...AFFINITY_PAIRS.map(([, colorName]) => [colorName, { value: 0 }]),
    ]),
  );

  const chargeMap = useRef<Record<ColorName, { value: number }>>({
    Coral: { value: 0 },
    Gold: { value: 0 },
    Emerald: { value: 0 },
  });
  const chargeCompletedRef = useRef(new Set<ColorName>());
  const maxHoldTimerMap = useRef<Record<ColorName, number>>({
    Coral: 0,
    Gold: 0,
    Emerald: 0,
  });

  const { uniforms, addDrop } = useWaterCaustics();
  const waterPosition = uniforms.waterPosition.value;
  const waterSize = uniforms.waterSize.value;

  const tickConnections = () => {
    const pos = positionsMapRef.current;
    const connected = connectedRef.current;
    for (const [whiteId, colorName] of AFFINITY_PAIRS) {
      const white = pos.get(whiteId);
      const colored = pos.get(colorName);
      if (!white || !colored) continue;
      const key = `${whiteId}-${colorName}`;
      const dist = white.distanceTo(colored);
      if (!connected.has(key) && dist < D_CONNECT) connected.add(key);
      else if (connected.has(key) && dist > D_MAX) connected.delete(key);
    }
  };

  const tickGlow = (time: number, delta: number) => {
    const connected = connectedRef.current;
    const glowMap = connectionGlowMap.current;
    const twinkle = Math.abs(Math.sin(time * 12.0));
    for (const [whiteId, colorName] of AFFINITY_PAIRS) {
      const key = `${whiteId}-${colorName}`;
      if (connected.has(key)) {
        glowMap[whiteId].value = twinkle;
        glowMap[colorName].value = twinkle;
      } else {
        glowMap[whiteId].value = Math.max(
          0,
          glowMap[whiteId].value - delta * 3,
        );
        glowMap[colorName].value = Math.max(
          0,
          glowMap[colorName].value - delta * 3,
        );
      }
    }
  };

  const MAX_HOLD_DURATION = 4.0; // seconds to hold 100% after disconnecting

  const tickCharge = (delta: number) => {
    const connected = connectedRef.current;
    const charges = chargeMap.current;
    const chargeCompleted = chargeCompletedRef.current;
    const holdTimers = maxHoldTimerMap.current;
    for (const [whiteId, colorName] of AFFINITY_PAIRS) {
      const charge = charges[colorName];

      // Check max BEFORE drain — catches click-sourced 1.0 before this frame's drain runs
      if (charge.value >= 1.0 && !chargeCompleted.has(colorName)) {
        chargeCompleted.add(colorName);
        holdTimers[colorName] = MAX_HOLD_DURATION;
      }

      if (connected.has(`${whiteId}-${colorName}`)) {
        charge.value = Math.min(1, charge.value + 0.15 * delta);
        holdTimers[colorName] = MAX_HOLD_DURATION;
      } else if (chargeCompleted.has(colorName) && holdTimers[colorName] > 0) {
        holdTimers[colorName] = Math.max(0, holdTimers[colorName] - delta);
        // no drain during hold
      } else {
        charge.value = Math.max(0, charge.value - 0.02 * delta);
        chargeCompleted.delete(colorName);
      }
    }
  };

  const handleSurfaceReach = (pos: THREE.Vector3) => {
    const x = ((pos.x - waterPosition.x) / waterSize) * 2;
    const y = ((pos.z - waterPosition.z) / waterSize) * 2;
    addDrop(x, y, 0.06, 0.5);
  };

  useFrame(({ clock }, delta) => {
    tickConnections();
    tickGlow(clock.getElapsedTime(), delta);
    tickCharge(delta);
  });

  return (
    <>
      {JELLIES.map(({ name, ...rest }) => (
        <Jellyfish
          key={name}
          {...rest}
          onPositionUpdate={(pos) => positionsMapRef.current.set(name, pos)}
          connectionGlowRef={connectionGlowMap.current[name]}
          chargeRef={chargeMap.current[name as ColorName]}
          onSurfaceReach={handleSurfaceReach}
        />
      ))}
      {AFFINITY_PAIRS.map(([, colorName]) => {
        const jelly = JELLIES.find((j) => j.name === colorName)!;
        return (
          <Particles
            key={colorName}
            positionsMapRef={positionsMapRef}
            targetId={colorName}
            chargeRef={chargeMap.current[colorName]}
            color={jelly.colors.base}
          />
        );
      })}
    </>
  );
}
