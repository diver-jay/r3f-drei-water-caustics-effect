import { useRef, useCallback, useMemo } from "react";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import { useWaterCaustics } from "../water-caustics";
import { waterSurfaceVertexShader } from "../water-caustics/shaders";

interface WaterSurfaceProps {
  position?: [number, number, number];
  enableMouseInteraction?: boolean;
}

export default function WaterSurface({
  position = [0, 0, 0],
  enableMouseInteraction = true,
}: WaterSurfaceProps) {
  const { uniforms, addDrop } = useWaterCaustics();
  const lastMouseDrop = useRef(0);

  const waterPosition = uniforms.waterPosition.value;
  const waterSize = uniforms.waterSize.value;

  // Convert world hit position to simulation coordinates (-1 to 1)
  const worldToSim = useCallback(
    (worldX: number, worldZ: number) => {
      const x = ((worldX - waterPosition.x) / waterSize) * 2;
      const y = ((worldZ - waterPosition.z) / waterSize) * 2;
      return { x, y };
    },
    [waterPosition, waterSize],
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

  const material = useMemo(
    () =>
      new CustomShaderMaterial({
        baseMaterial: THREE.MeshPhysicalMaterial,
        vertexShader: waterSurfaceVertexShader,
        uniforms: {
          ...uniforms,
          heightScale: { value: 2 },
        },
        transmission: 1,
        ior: 1.935,
        thickness: -0.15,
        roughness: 0.1,
        metalness: 0,
        clearcoat: 0.05,
        clearcoatRoughness: 0.1,
        specularIntensity: 0.2,
        color: new THREE.Color("#88ccee"),
        side: THREE.DoubleSide,
      }),
    [uniforms],
  );

  return (
    <mesh
      position={position}
      rotation={[-Math.PI * 0.5, 0, 0]}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[waterSize, waterSize, 128, 128]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
