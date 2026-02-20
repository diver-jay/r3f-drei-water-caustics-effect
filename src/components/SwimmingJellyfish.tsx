import * as THREE from "three";
import { useCallback } from "react";
import { useWaterCaustics } from "../water-caustics";
import Jellyfish from "../jellyfish/Jellyfish";

// ─── Jellyfish page mapping ────────────────────────────────────────────────────
const JELLIES = [
  {
    name: "Coral",
    route: "/now",
    color: new THREE.Color("#ff6b6b"),
    diffuseB: new THREE.Color("#7a1a1a"),
    faintColor: new THREE.Color("#ff4444"),
    initialAngle: 0,
    initialPosition: new THREE.Vector3(1.5, 1.5, 0.5),
  },
  {
    name: "Gold",
    route: "/uses",
    color: new THREE.Color("#ffd93d"),
    diffuseB: new THREE.Color("#8b6b00"),
    faintColor: new THREE.Color("#ffcc00"),
    initialAngle: 2.1,
    initialPosition: new THREE.Vector3(-1.0, 1.8, -1.0),
  },
  {
    name: "Emerald",
    route: "/playground",
    color: new THREE.Color("#6bcb77"),
    diffuseB: new THREE.Color("#1a5c25"),
    faintColor: new THREE.Color("#44bb55"),
    initialAngle: 4.2,
    initialPosition: new THREE.Vector3(-0.5, 1.2, 1.5),
  },
];

export default function SwimmingJellyfish() {
  const { uniforms, addDrop } = useWaterCaustics();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const waterPosition = uniforms.waterPosition.value as any;
  const waterSize = uniforms.waterSize.value as number;

  const worldToSim = useCallback(
    (worldX: number, worldZ: number) => {
      const x = ((worldX - waterPosition.x) / waterSize) * 2;
      const y = ((worldZ - waterPosition.z) / waterSize) * 2;
      return { x, y };
    },
    [waterPosition, waterSize],
  );

  const handleSurfaceReach = useCallback(
    (position: THREE.Vector3, route: string, name: string) => {
      const { x, y } = worldToSim(position.x, position.z);
      addDrop(x, y, 0.06, 0.5);
      console.log(`🪼 Navigate to: ${route} (${name})`);
    },
    [addDrop, worldToSim],
  );

  return (
    <>
      {JELLIES.map((jelly) => (
        <Jellyfish
          key={jelly.name}
          color={jelly.color}
          diffuseB={jelly.diffuseB}
          faintColor={jelly.faintColor}
          initialAngle={jelly.initialAngle}
          initialPosition={jelly.initialPosition}
          onSurfaceReach={(pos: THREE.Vector3) =>
            handleSurfaceReach(pos, jelly.route, jelly.name)
          }
        />
      ))}
    </>
  );
}
