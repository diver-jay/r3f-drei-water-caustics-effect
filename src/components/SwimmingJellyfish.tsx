import * as THREE from "three";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useWaterCaustics } from "../water-caustics";
import Jellyfish from "../jellyfish/Jellyfish";

// 같은 affinity 쌍 — [id_A, id_B]
const AFFINITY_PAIRS = [
  ["J1", "J2"], // Coral
  ["J3", "J4"], // Gold
  ["J5", "J6"], // Emerald
] as const;

const D_CONNECT = 3.0 * 0.2;  // 0.60 — 연결 형성
const D_MAX     = 3.0 * 0.35; // 1.05 — 연결 해제 (hysteresis)

// ─── Jellyfish instances ───────────────────────────────────────────────────────
const JELLIES = [
  // ── 흰/투명 6마리 (faintColor = hover 시 드러나는 affinity 색) ────────────
  {
    name: "J1",
    color: new THREE.Color("#d0e8ff"),
    diffuseB: new THREE.Color("#a0c4ee"),
    faintColor: new THREE.Color("#ff6b6b"), // affinity: Coral
    initialAngle: 0.0,
    initialPosition: new THREE.Vector3(1.5, 1.4, 0.3),
  },
  {
    name: "J2",
    color: new THREE.Color("#e8f2ff"),
    diffuseB: new THREE.Color("#b0cce8"),
    faintColor: new THREE.Color("#ff6b6b"), // affinity: Coral
    initialAngle: 1.3,
    initialPosition: new THREE.Vector3(-1.2, 1.9, -0.8),
  },
  {
    name: "J3",
    color: new THREE.Color("#c8e0f8"),
    diffuseB: new THREE.Color("#90b8e0"),
    faintColor: new THREE.Color("#ffd93d"), // affinity: Gold
    initialAngle: 2.6,
    initialPosition: new THREE.Vector3(0.2, 1.2, 1.8),
  },
  {
    name: "J4",
    color: new THREE.Color("#dceeff"),
    diffuseB: new THREE.Color("#a8c8e8"),
    faintColor: new THREE.Color("#ffd93d"), // affinity: Gold
    initialAngle: 4.0,
    initialPosition: new THREE.Vector3(-0.8, 2.1, 0.6),
  },
  {
    name: "J5",
    color: new THREE.Color("#e4f0ff"),
    diffuseB: new THREE.Color("#b8d4f0"),
    faintColor: new THREE.Color("#6bcb77"), // affinity: Emerald
    initialAngle: 5.2,
    initialPosition: new THREE.Vector3(1.0, 1.6, -1.4),
  },
  {
    name: "J6",
    color: new THREE.Color("#d8eaff"),
    diffuseB: new THREE.Color("#a4c0e0"),
    faintColor: new THREE.Color("#6bcb77"), // affinity: Emerald
    initialAngle: 3.3,
    initialPosition: new THREE.Vector3(-1.8, 1.5, 1.2),
  },
  // ── 빨/노/초 3마리 (크기 1.3배, 느린 유영) ──────────────────────────────────
  {
    name: "Coral",
    color: new THREE.Color("#ff6b6b"),
    diffuseB: new THREE.Color("#7a1a1a"),
    faintColor: new THREE.Color("#ff4444"),
    initialAngle: 0.7,
    initialPosition: new THREE.Vector3(1.5, 1.5, 0.5),
    speed: 1.0,
    scale: 1.3,
  },
  {
    name: "Gold",
    color: new THREE.Color("#ffd93d"),
    diffuseB: new THREE.Color("#8b6b00"),
    faintColor: new THREE.Color("#ffcc00"),
    initialAngle: 2.1,
    initialPosition: new THREE.Vector3(-1.0, 1.8, -1.0),
    speed: 1.0,
    scale: 1.3,
  },
  {
    name: "Emerald",
    color: new THREE.Color("#6bcb77"),
    diffuseB: new THREE.Color("#1a5c25"),
    faintColor: new THREE.Color("#44bb55"),
    initialAngle: 3.8,
    initialPosition: new THREE.Vector3(-0.5, 1.2, 1.5),
    speed: 1.0,
    scale: 1.3,
  },
];

export default function SwimmingJellyfish() {
  const positionsMapRef = useRef(new Map<string, THREE.Vector3>());
  const connectedRef = useRef(new Set<string>());

  useFrame(() => {
    const pos = positionsMapRef.current;
    const connected = connectedRef.current;

    for (const [idA, idB] of AFFINITY_PAIRS) {
      const pairKey = `${idA}-${idB}`;
      const a = pos.get(idA);
      const b = pos.get(idB);
      if (!a || !b) continue;

      const dist = a.distanceTo(b);
      const isConnected = connected.has(pairKey);

      if (!isConnected && dist < D_CONNECT) {
        connected.add(pairKey);
        console.log(`[연결] ${pairKey} 연결됨 (dist: ${dist.toFixed(2)})`);
      } else if (isConnected && dist > D_MAX) {
        connected.delete(pairKey);
        console.log(`[해제] ${pairKey} 해제됨 (dist: ${dist.toFixed(2)})`);
      }
    }
  });

  const { uniforms, addDrop } = useWaterCaustics();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waterPosition = uniforms.waterPosition.value as any;
  const waterSize = uniforms.waterSize.value as number;

  function handleSurfaceReach(pos: THREE.Vector3) {
    const x = ((pos.x - waterPosition.x) / waterSize) * 2;
    const y = ((pos.z - waterPosition.z) / waterSize) * 2;
    addDrop(x, y, 0.06, 0.5);
  }

  return (
    <>
      {JELLIES.map((jelly) => (
        <Jellyfish
          key={jelly.name}
          id={jelly.name}
          positionsMapRef={positionsMapRef}
          color={jelly.color}
          diffuseB={jelly.diffuseB}
          faintColor={jelly.faintColor}
          initialAngle={jelly.initialAngle}
          initialPosition={jelly.initialPosition}
          onSurfaceReach={handleSurfaceReach}
          speed={jelly.speed}
          size={jelly.scale}
        />
      ))}
    </>
  );
}
