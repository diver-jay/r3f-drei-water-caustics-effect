import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";
import Jellyfish from "../jellyfish/Jellyfish";

// ─── Jellyfish instances ───────────────────────────────────────────────────────
const JELLIES = [
  // ── 흰/투명 5마리 ──────────────────────────────────────────────────────────
  {
    name: "J1",
    color: new THREE.Color("#d0e8ff"),
    diffuseB: new THREE.Color("#a0c4ee"),
    faintColor: new THREE.Color("#cce4ff"),
    hoverColor: new THREE.Color("#eef6ff"),
    hoverDiffuseB: new THREE.Color("#c8e0f8"),
    hoverFaintColor: new THREE.Color("#e8f4ff"),
    initialAngle: 0.0,
    initialPosition: new THREE.Vector3(1.5, 1.4, 0.3),
  },
  {
    name: "J2",
    color: new THREE.Color("#e8f2ff"),
    diffuseB: new THREE.Color("#b0cce8"),
    faintColor: new THREE.Color("#ddeeff"),
    hoverColor: new THREE.Color("#f5f9ff"),
    hoverDiffuseB: new THREE.Color("#d4e8f8"),
    hoverFaintColor: new THREE.Color("#f0f8ff"),
    initialAngle: 1.3,
    initialPosition: new THREE.Vector3(-1.2, 1.9, -0.8),
  },
  {
    name: "J3",
    color: new THREE.Color("#c8e0f8"),
    diffuseB: new THREE.Color("#90b8e0"),
    faintColor: new THREE.Color("#c0d8f8"),
    hoverColor: new THREE.Color("#e4f2ff"),
    hoverDiffuseB: new THREE.Color("#bcd8f0"),
    hoverFaintColor: new THREE.Color("#dceeff"),
    initialAngle: 2.6,
    initialPosition: new THREE.Vector3(0.2, 1.2, 1.8),
  },
  {
    name: "J4",
    color: new THREE.Color("#dceeff"),
    diffuseB: new THREE.Color("#a8c8e8"),
    faintColor: new THREE.Color("#d0e8ff"),
    hoverColor: new THREE.Color("#eef6ff"),
    hoverDiffuseB: new THREE.Color("#cce0f4"),
    hoverFaintColor: new THREE.Color("#e8f4ff"),
    initialAngle: 4.0,
    initialPosition: new THREE.Vector3(-0.8, 2.1, 0.6),
  },
  {
    name: "J5",
    color: new THREE.Color("#e4f0ff"),
    diffuseB: new THREE.Color("#b8d4f0"),
    faintColor: new THREE.Color("#d8ecff"),
    hoverColor: new THREE.Color("#f2f8ff"),
    hoverDiffuseB: new THREE.Color("#d4ecff"),
    hoverFaintColor: new THREE.Color("#eaf6ff"),
    initialAngle: 5.2,
    initialPosition: new THREE.Vector3(1.0, 1.6, -1.4),
  },
  // ── 빨/노/초 3마리 ─────────────────────────────────────────────────────────
  {
    name: "Coral",
    color: new THREE.Color("#ff6b6b"),
    diffuseB: new THREE.Color("#7a1a1a"),
    faintColor: new THREE.Color("#ff4444"),
    hoverColor: new THREE.Color("#ffb3b3"),
    hoverDiffuseB: new THREE.Color("#c45050"),
    hoverFaintColor: new THREE.Color("#ff8888"),
    initialAngle: 0.7,
    initialPosition: new THREE.Vector3(1.5, 1.5, 0.5),
  },
  {
    name: "Gold",
    color: new THREE.Color("#ffd93d"),
    diffuseB: new THREE.Color("#8b6b00"),
    faintColor: new THREE.Color("#ffcc00"),
    hoverColor: new THREE.Color("#ffec8a"),
    hoverDiffuseB: new THREE.Color("#c4a020"),
    hoverFaintColor: new THREE.Color("#ffe050"),
    initialAngle: 2.1,
    initialPosition: new THREE.Vector3(-1.0, 1.8, -1.0),
  },
  {
    name: "Emerald",
    color: new THREE.Color("#6bcb77"),
    diffuseB: new THREE.Color("#1a5c25"),
    faintColor: new THREE.Color("#44bb55"),
    hoverColor: new THREE.Color("#a8e8b0"),
    hoverDiffuseB: new THREE.Color("#3a9c4a"),
    hoverFaintColor: new THREE.Color("#80dd90"),
    initialAngle: 3.8,
    initialPosition: new THREE.Vector3(-0.5, 1.2, 1.5),
  },
];

export default function SwimmingJellyfish() {
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
          color={jelly.color}
          diffuseB={jelly.diffuseB}
          faintColor={jelly.faintColor}
          hoverColor={jelly.hoverColor}
          hoverDiffuseB={jelly.hoverDiffuseB}
          hoverFaintColor={jelly.hoverFaintColor}
          initialAngle={jelly.initialAngle}
          initialPosition={jelly.initialPosition}
          onSurfaceReach={handleSurfaceReach}
        />
      ))}
    </>
  );
}
