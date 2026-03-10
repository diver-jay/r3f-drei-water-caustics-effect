import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWaterCaustics } from "../water-caustics";
import Jellyfish from "../jellyfish/Jellyfish";
import Particles from "./Particles";

const AFFINITY_PAIRS = [
  ["J1", "J2", "Coral"],
  ["J3", "J4", "Gold"],
  ["J5", "J6", "Emerald"],
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
      base: new THREE.Color("#e8f2ff"),
      dark: new THREE.Color("#b0cce8"),
      glow: new THREE.Color("#ff6b6b"),
    },
    initial: { azimuth: 1.3, position: new THREE.Vector3(-1.2, 1.9, -0.8) },
  },
  {
    name: "J3",
    colors: {
      base: new THREE.Color("#c8e0f8"),
      dark: new THREE.Color("#90b8e0"),
      glow: new THREE.Color("#ffd93d"),
    },
    initial: { azimuth: 2.6, position: new THREE.Vector3(0.2, 1.2, 1.8) },
  },
  {
    name: "J4",
    colors: {
      base: new THREE.Color("#dceeff"),
      dark: new THREE.Color("#a8c8e8"),
      glow: new THREE.Color("#ffd93d"),
    },
    initial: { azimuth: 4.0, position: new THREE.Vector3(-0.8, 2.1, 0.6) },
  },
  {
    name: "J5",
    colors: {
      base: new THREE.Color("#e4f0ff"),
      dark: new THREE.Color("#b8d4f0"),
      glow: new THREE.Color("#6bcb77"),
    },
    initial: { azimuth: 5.2, position: new THREE.Vector3(1.0, 1.6, -1.4) },
  },
  {
    name: "J6",
    colors: {
      base: new THREE.Color("#d8eaff"),
      dark: new THREE.Color("#a4c0e0"),
      glow: new THREE.Color("#6bcb77"),
    },
    initial: { azimuth: 3.3, position: new THREE.Vector3(-1.8, 1.5, 1.2) },
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

const WHITE_JELLYFISH_IDS = ["J1", "J2", "J3", "J4", "J5", "J6"] as const;

export default function SwimmingJellyfish() {
  const positionsMapRef = useRef(new Map<string, THREE.Vector3>());
  const connectedRef = useRef(new Set<string>());

  const connectionGlowMap = useRef<Record<string, { value: number }>>(
    Object.fromEntries(WHITE_JELLYFISH_IDS.map((id) => [id, { value: 0 }])),
  );

  const chargeMap = useRef<Record<ColorName, { value: number }>>({
    Coral: { value: 0 },
    Gold: { value: 0 },
    Emerald: { value: 0 },
  });
  const chargeCompletedRef = useRef(new Set<ColorName>());

  const { uniforms, addDrop } = useWaterCaustics();
  const waterPosition = uniforms.waterPosition.value;
  const waterSize = uniforms.waterSize.value;

  const tickConnections = () => {
    const pos = positionsMapRef.current;
    const connected = connectedRef.current;
    for (const [idA, idB] of AFFINITY_PAIRS) {
      const pairKey = `${idA}-${idB}`;
      const a = pos.get(idA);
      const b = pos.get(idB);
      if (!a || !b) continue;
      const dist = a.distanceTo(b);
      if (!connected.has(pairKey) && dist < D_CONNECT) connected.add(pairKey);
      else if (connected.has(pairKey) && dist > D_MAX)
        connected.delete(pairKey);
    }
  };

  const tickGlow = (time: number, delta: number) => {
    const connected = connectedRef.current;
    const glowMap = connectionGlowMap.current;
    for (const [idA, idB] of AFFINITY_PAIRS) {
      const pairKey = `${idA}-${idB}`;
      const glowA = glowMap[idA];
      const glowB = glowMap[idB];
      if (connected.has(pairKey)) {
        const twinkle = Math.abs(Math.sin(time * 12.0));
        glowA.value = twinkle;
        glowB.value = twinkle;
      } else {
        glowA.value = Math.max(0, glowA.value - delta * 3);
        glowB.value = Math.max(0, glowB.value - delta * 3);
      }
    }
  };

  const tickCharge = (delta: number) => {
    const connected = connectedRef.current;
    const charges = chargeMap.current;
    const chargeCompleted = chargeCompletedRef.current;
    for (const [idA, idB, colorName] of AFFINITY_PAIRS) {
      const pairKey = `${idA}-${idB}`;
      const charge = charges[colorName];
      if (connected.has(pairKey)) {
        charge.value = Math.min(1, charge.value + 0.15 * delta);
      } else {
        charge.value = Math.max(0, charge.value - 0.05 * delta);
        chargeCompleted.delete(colorName);
      }
      if (charge.value >= 1.0 && !chargeCompleted.has(colorName)) {
        chargeCompleted.add(colorName);
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
      {AFFINITY_PAIRS.map(([, , colorName]) => {
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
