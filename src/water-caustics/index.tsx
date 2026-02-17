import {
  createContext,
  useContext,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useFrame, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useWaterSimulation } from "./use-water-simulation";

/**
 * Shared uniform references. Since these are `{ value }` objects,
 * spreading them into consumer ShaderMaterials shares the same references.
 * Provider mutates `.value` each frame → all consumers auto-update.
 */
interface WaterCausticsUniforms {
  waterTexture: { value: THREE.Texture | null };
  waterPosition: { value: THREE.Vector3 };
  waterSize: { value: number };
  chromaticAberration: { value: number };
  time: { value: number };
  waterSurfaceY: { value: number };
  depthColor: { value: THREE.Color };
  depthDistance: { value: number };
}

interface WaterCausticsContextValue {
  uniforms: WaterCausticsUniforms;
  addDrop: (x: number, y: number, radius?: number, strength?: number) => void;
}

const WaterCausticsContext = createContext<WaterCausticsContextValue | null>(
  null,
);

// ─── Hook ───────────────────────────────────────────────────────────

export function useWaterCaustics(): WaterCausticsContextValue {
  const ctx = useContext(WaterCausticsContext);
  if (!ctx) {
    throw new Error(
      "useWaterCaustics must be used within <WaterCausticsProvider>",
    );
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────

interface WaterCausticsProviderProps {
  children: ReactNode;
  position?: [number, number, number];
  size?: number;
  enableAutoDrops?: boolean;
  chromaticAberration?: number;
  waterSurfaceY?: number;
  depthColor?: string;
  depthDistance?: number;
}

export function WaterCausticsProvider({
  children,
  position = [0, 0, 0],
  size = 10,
  enableAutoDrops = true,
  chromaticAberration = 0.005,
  waterSurfaceY = 5,
  depthColor = "#006bbe",
  depthDistance = 5,
}: WaterCausticsProviderProps) {
  const { getTexture, addDrop } = useWaterSimulation(256, enableAutoDrops);

  // Create shared uniforms once. Consumers spread these into their materials.
  const uniforms = useRef<WaterCausticsUniforms>({
    waterTexture: { value: null },
    waterPosition: { value: new THREE.Vector3(...position) },
    waterSize: { value: size },
    chromaticAberration: { value: chromaticAberration },
    time: { value: 0 },
    waterSurfaceY: { value: waterSurfaceY },
    depthColor: { value: new THREE.Color(depthColor) },
    depthDistance: { value: depthDistance },
  }).current;

  // Sync prop changes to uniform values
  useMemo(() => {
    uniforms.waterPosition.value.set(position[0], position[1], position[2]);
  }, [position, uniforms]);

  useMemo(() => {
    uniforms.waterSize.value = size;
  }, [size, uniforms]);

  useMemo(() => {
    uniforms.chromaticAberration.value = chromaticAberration;
  }, [chromaticAberration, uniforms]);

  // Update per-frame uniforms
  useFrame((state) => {
    uniforms.waterTexture.value = getTexture();
    uniforms.time.value = state.clock.elapsedTime;
  });

  const contextValue = useMemo(
    () => ({ uniforms, addDrop }),
    [uniforms, addDrop],
  );

  return (
    <WaterCausticsContext.Provider value={contextValue}>
      {children}
    </WaterCausticsContext.Provider>
  );
}

// ─── Interaction Plane ──────────────────────────────────────────────

interface CausticsInteractionPlaneProps {
  enableMouseInteraction?: boolean;
}

export function CausticsInteractionPlane({
  enableMouseInteraction = true,
}: CausticsInteractionPlaneProps) {
  const { uniforms, addDrop } = useWaterCaustics();
  const lastMouseDrop = useRef(0);

  const position = uniforms.waterPosition.value;
  const size = uniforms.waterSize.value;

  // Convert world hit position to simulation coordinates (-1 to 1)
  const worldToSim = useCallback(
    (worldX: number, worldZ: number) => {
      const x = ((worldX - position.x) / size) * 2;
      const y = ((worldZ - position.z) / size) * 2;
      return { x, y };
    },
    [position, size],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enableMouseInteraction) return;

      const now = performance.now();
      if (now - lastMouseDrop.current < 50) return;
      lastMouseDrop.current = now;

      const { x, y } = worldToSim(event.point.x, event.point.z);
      addDrop(x, y, 0.02, 0.15);
    },
    [enableMouseInteraction, addDrop, worldToSim],
  );

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enableMouseInteraction) return;

      const { x, y } = worldToSim(event.point.x, event.point.z);
      addDrop(x, y, 0.04, 0.4);
    },
    [enableMouseInteraction, addDrop, worldToSim],
  );

  return (
    <mesh
      position={[position.x, position.y, position.z]}
      rotation={[-Math.PI * 0.5, 0, 0]}
      scale={size}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}
