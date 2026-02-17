import { useState, useRef, useCallback, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";

const BUBBLE_COLORS = [
  new THREE.Color("#ff6b6b"), // Red
  new THREE.Color("#ffd93d"), // Yellow
  new THREE.Color("#6bcb77"), // Green
];

interface BubbleData {
  id: number;
  spawnX: number;
  spawnZ: number;
  size: number;
  velocity: number;
  wobblePhase: number;
  wobbleFrequency: number;
  wobbleAmplitude: number;
  color: THREE.Color;
}

// ─── Individual Bubble ─────────────────────────────────────────────

function Bubble({
  id,
  spawnX,
  spawnZ,
  size,
  velocity,
  wobblePhase,
  wobbleFrequency,
  wobbleAmplitude,
  color,
  onBurst,
}: BubbleData & {
  onBurst: (id: number, x: number, z: number, size: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const positionY = useRef(0);
  const hasBurst = useRef(false);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        transmission: 1.0,
        thickness: 0.5,
        ior: 1.935,
        roughness: 0.0,
        metalness: 0.0,
        clearcoat: 0.3,
        clearcoatRoughness: 0.05,
        iridescence: 1.0,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [100, 400],
        dispersion: 0.15,
        specularIntensity: 3,
        specularColor: new THREE.Color(0xffffff),
        color: color,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide,
        transparent: true,
      }),
    [color],
  );

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || hasBurst.current) return;

    // Rise
    positionY.current += velocity * delta;

    // Wobble on XZ axes
    const time = state.clock.elapsedTime;
    const wobbleX =
      Math.sin(time * wobbleFrequency + wobblePhase) * wobbleAmplitude;
    const wobbleZ =
      Math.cos(time * wobbleFrequency * 0.7 + wobblePhase + 1.0) *
      wobbleAmplitude;

    mesh.position.set(spawnX + wobbleX, positionY.current, spawnZ + wobbleZ);

    // Subtle squish deformation while wobbling
    const squish = Math.sin(time * wobbleFrequency * 2 + wobblePhase) * 0.1;
    mesh.scale.set(
      size * (1 - squish * 0.5),
      size * (1 + squish),
      size * (1 - squish * 0.5),
    );

    // Surface collision (water surface at Y=5)
    if (positionY.current >= 5) {
      hasBurst.current = true;
      onBurst(id, mesh.position.x, mesh.position.z, size);
    }
  });

  return (
    <mesh ref={meshRef} position={[spawnX, 0, spawnZ]}>
      <sphereGeometry args={[1, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─── Rising Bubbles Coordinator ────────────────────────────────────

interface RisingBubblesProps {
  spawnInterval?: number;
  spawnCount?: [number, number];
  sizeRange?: [number, number];
  riseSpeed?: [number, number];
  wobbleStrength?: number;
}

export default function RisingBubbles({
  spawnInterval = 3,
  spawnCount = [2, 3],
  sizeRange = [0.4, 1.0],
  riseSpeed = [0.5, 1.0],
  wobbleStrength = 0.15,
}: RisingBubblesProps) {
  const { uniforms, addDrop } = useWaterCaustics();
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const lastSpawnTime = useRef(0);
  const nextId = useRef(0);

  const waterPosition = uniforms.waterPosition.value;
  const waterSize = uniforms.waterSize.value;

  const worldToSim = useCallback(
    (worldX: number, worldZ: number) => {
      const x = ((worldX - waterPosition.x) / waterSize) * 2;
      const y = ((worldZ - waterPosition.z) / waterSize) * 2;
      return { x, y };
    },
    [waterPosition, waterSize],
  );

  const handleBurst = useCallback(
    (id: number, worldX: number, worldZ: number, size: number) => {
      const { x, y } = worldToSim(worldX, worldZ);
      const radius = 0.02 + size * 0.1;
      const strength = 0.15 + size * 0.5;
      addDrop(x, y, radius, strength);
      setBubbles((prev) => prev.filter((b) => b.id !== id));
    },
    [addDrop, worldToSim],
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (time - lastSpawnTime.current >= spawnInterval) {
      const count =
        spawnCount[0] +
        Math.floor(Math.random() * (spawnCount[1] - spawnCount[0] + 1));

      const newBubbles: BubbleData[] = [];
      for (let i = 0; i < count; i++) {
        newBubbles.push({
          id: nextId.current++,
          spawnX: (Math.random() - 0.5) * waterSize * 0.8,
          spawnZ: (Math.random() - 0.5) * waterSize * 0.8,
          size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
          velocity:
            riseSpeed[0] + Math.random() * (riseSpeed[1] - riseSpeed[0]),
          wobblePhase: Math.random() * Math.PI * 2,
          wobbleFrequency: 2 + Math.random() * 2,
          wobbleAmplitude: wobbleStrength * (0.5 + Math.random() * 0.5),
          color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
        });
      }

      setBubbles((prev) => [...prev, ...newBubbles]);
      lastSpawnTime.current = time;
    }
  });

  return (
    <>
      {bubbles.map((bubble) => (
        <Bubble key={bubble.id} {...bubble} onBurst={handleBurst} />
      ))}
    </>
  );
}
