import { useState, useRef, useCallback, useMemo } from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";

// ─── Constants ────────────────────────────────────────────────────

const BUBBLE_CONFIG = [
  { color: new THREE.Color("#ff6b6b"), page: "Now", route: "/now" },
  { color: new THREE.Color("#ffd93d"), page: "Uses", route: "/uses" },
  { color: new THREE.Color("#6bcb77"), page: "Playground", route: "/playground" },
] as const;

const SWEET_SPOT_THRESHOLD = 0.8;
const WATER_SURFACE_Y = 5;
const BOUNCE_DURATION = 300; // ms
const PARTICLE_LIFESPAN = 0.6; // seconds

// ─── Types ────────────────────────────────────────────────────────

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
  pageName: string;
  pageRoute: string;
}

interface ParticleData {
  id: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  size: number;
  color: THREE.Color;
}

// ─── Particle ─────────────────────────────────────────────────────

const _particleMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  depthWrite: false,
});

function Particle({
  id,
  position,
  velocity,
  life: initialLife,
  size,
  color,
  onComplete,
}: ParticleData & { onComplete: (id: number) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const life = useRef(initialLife);
  const pos = useRef(position.clone());
  const vel = useRef(velocity.clone());

  const material = useMemo(() => {
    const mat = _particleMaterial.clone();
    mat.color = color;
    return mat;
  }, [color]);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    life.current -= delta / PARTICLE_LIFESPAN;
    if (life.current <= 0) {
      onComplete(id);
      return;
    }

    // Physics: gravity + drag
    vel.current.y -= 4.0 * delta;
    vel.current.multiplyScalar(1 - 1.5 * delta); // drag
    pos.current.add(vel.current.clone().multiplyScalar(delta));

    mesh.position.copy(pos.current);
    const scale = size * life.current;
    mesh.scale.setScalar(scale);
    material.opacity = life.current;
  });

  return (
    <mesh ref={meshRef} position={pos.current}>
      <sphereGeometry args={[1, 6, 6]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

// ─── Individual Bubble ────────────────────────────────────────────

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
  pageName,
  onBurst,
  onSweetSpotClick,
}: BubbleData & {
  onBurst: (id: number, x: number, z: number, size: number) => void;
  onSweetSpotClick: (
    id: number,
    position: THREE.Vector3,
    color: THREE.Color,
    size: number,
    pageRoute: string,
  ) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const positionY = useRef(0);
  const hasBurst = useRef(false);
  const inSweetSpot = useRef(false);
  const bounceScale = useRef(1.0);
  const [showLabel, setShowLabel] = useState(false);

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
    const group = groupRef.current;
    if (!group || hasBurst.current) return;

    // Rise
    positionY.current += velocity * delta;

    // Wobble on XZ axes
    const time = state.clock.elapsedTime;
    const wobbleX =
      Math.sin(time * wobbleFrequency + wobblePhase) * wobbleAmplitude;
    const wobbleZ =
      Math.cos(time * wobbleFrequency * 0.7 + wobblePhase + 1.0) *
      wobbleAmplitude;

    // Move entire group (bubble mesh + hit sphere + label follow automatically)
    group.position.set(
      spawnX + wobbleX,
      positionY.current,
      spawnZ + wobbleZ,
    );

    // Subtle squish deformation while wobbling
    const squish = Math.sin(time * wobbleFrequency * 2 + wobblePhase) * 0.1;
    const b = bounceScale.current;
    group.scale.set(
      size * (1 - squish * 0.5) * b,
      size * (1 + squish) * b,
      size * (1 - squish * 0.5) * b,
    );

    // Bounce decay (smooth spring back)
    if (b > 1.001) {
      bounceScale.current += (1.0 - b) * delta * 12;
    }

    // Sweet Spot detection
    const progress = positionY.current / WATER_SURFACE_Y;
    const nowInSweetSpot = progress >= SWEET_SPOT_THRESHOLD && progress < 1.0;

    if (nowInSweetSpot !== inSweetSpot.current) {
      inSweetSpot.current = nowInSweetSpot;
      setShowLabel(nowInSweetSpot);

      // Glow effect
      material.emissiveIntensity = nowInSweetSpot ? 0.4 : 0;
      if (nowInSweetSpot) {
        material.emissive = color;
      }
    }

    // Surface collision → auto burst
    if (positionY.current >= WATER_SURFACE_Y) {
      hasBurst.current = true;
      onBurst(id, group.position.x, group.position.z, size);
    }
  });

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const group = groupRef.current;
      if (!group || hasBurst.current) return;

      if (inSweetSpot.current) {
        // Sweet Spot click → burst with particles
        hasBurst.current = true;
        const worldPos = new THREE.Vector3();
        group.getWorldPosition(worldPos);
        onSweetSpotClick(id, worldPos, color, size, pageName);
      } else {
        // Early click → spring bounce
        bounceScale.current = 1.3;
      }
    },
    [id, color, size, pageName, onSweetSpotClick],
  );

  return (
    <group ref={groupRef}>
      {/* Visible bubble */}
      <mesh>
        <sphereGeometry args={[1, 32, 32]} />
        <primitive object={material} attach="material" />
      </mesh>

      {/* Invisible hit sphere (1.5x radius for easier clicking) */}
      <mesh scale={1.5} onClick={handleClick} visible={false}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial />
      </mesh>

      {/* Page name label in Sweet Spot */}
      {showLabel && (
        <Html position={[0, 1.5, 0]} center style={{ pointerEvents: "none" }}>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.65)",
              color: "white",
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              fontFamily: "system-ui, sans-serif",
              whiteSpace: "nowrap",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            {pageName}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Rising Bubbles Coordinator ───────────────────────────────────

interface RisingBubblesProps {
  spawnInterval?: number;
  spawnCount?: [number, number];
  sizeRange?: [number, number];
  riseSpeed?: [number, number];
  wobbleStrength?: number;
}

export default function RisingBubbles({
  spawnInterval = 3,
  spawnCount = [3, 3],
  sizeRange = [0.4, 1.0],
  riseSpeed = [0.8, 1.5],
  wobbleStrength = 0.15,
}: RisingBubblesProps) {
  const { uniforms, addDrop } = useWaterCaustics();
  const [bubbles, setBubbles] = useState<BubbleData[]>([]);
  const [particles, setParticles] = useState<ParticleData[]>([]);
  const lastSpawnTime = useRef(0);
  const nextId = useRef(0);
  const nextParticleId = useRef(0);

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

  // Auto burst when bubble reaches surface
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

  // Sweet Spot click → particle burst + ripple + console.log navigation
  const handleSweetSpotClick = useCallback(
    (
      id: number,
      position: THREE.Vector3,
      color: THREE.Color,
      size: number,
      pageRoute: string,
    ) => {
      // Water ripple
      const { x, y } = worldToSim(position.x, position.z);
      addDrop(x, y, 0.04 + size * 0.08, 0.3 + size * 0.4);

      // Create burst particles
      const count = 40 + Math.floor(Math.random() * 20);
      const newParticles: ParticleData[] = [];
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.8;
        const speed = 2.5 + Math.random() * 4.0;

        newParticles.push({
          id: nextParticleId.current++,
          position: position.clone(),
          velocity: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.cos(phi) * speed + 1.5,
            Math.sin(phi) * Math.sin(theta) * speed,
          ),
          life: 1.0,
          size: 0.08 + Math.random() * 0.12,
          color: color.clone(),
        });
      }

      setParticles((prev) => [...prev, ...newParticles]);
      setBubbles((prev) => prev.filter((b) => b.id !== id));

      // Phase 1: console.log for navigation (React Router in Phase 2)
      console.log(`🫧 Navigate to: ${pageRoute}`);
    },
    [addDrop, worldToSim],
  );

  const handleParticleComplete = useCallback((particleId: number) => {
    setParticles((prev) => prev.filter((p) => p.id !== particleId));
  }, []);

  // Helper to create a bubble with given config
  const createBubble = useCallback(
    (config: (typeof BUBBLE_CONFIG)[number]): BubbleData => ({
      id: nextId.current++,
      spawnX: (Math.random() - 0.5) * waterSize * 0.8,
      spawnZ: (Math.random() - 0.5) * waterSize * 0.8,
      size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
      velocity: riseSpeed[0] + Math.random() * (riseSpeed[1] - riseSpeed[0]),
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleFrequency: 2 + Math.random() * 2,
      wobbleAmplitude: wobbleStrength * (0.5 + Math.random() * 0.5),
      color: config.color,
      pageName: config.page,
      pageRoute: config.route,
    }),
    [waterSize, sizeRange, riseSpeed, wobbleStrength],
  );

  // Spawn bubbles with 3-color guarantee
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (time - lastSpawnTime.current >= spawnInterval) {
      const count =
        spawnCount[0] +
        Math.floor(Math.random() * (spawnCount[1] - spawnCount[0] + 1));

      const newBubbles: BubbleData[] = [];

      // Guarantee 1 of each color first
      for (const config of BUBBLE_CONFIG) {
        newBubbles.push(createBubble(config));
      }

      // Fill remaining slots with random colors
      for (let i = BUBBLE_CONFIG.length; i < count; i++) {
        const config =
          BUBBLE_CONFIG[Math.floor(Math.random() * BUBBLE_CONFIG.length)];
        newBubbles.push(createBubble(config));
      }

      setBubbles((prev) => [...prev, ...newBubbles]);
      lastSpawnTime.current = time;
    }
  });

  return (
    <>
      {bubbles.map((bubble) => (
        <Bubble
          key={bubble.id}
          {...bubble}
          onBurst={handleBurst}
          onSweetSpotClick={handleSweetSpotClick}
        />
      ))}
      {particles.map((particle) => (
        <Particle
          key={particle.id}
          {...particle}
          onComplete={handleParticleComplete}
        />
      ))}
    </>
  );
}
