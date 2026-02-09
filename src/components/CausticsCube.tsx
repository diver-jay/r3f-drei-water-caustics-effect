import { useMemo } from "react";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "../water-caustics/shaders";

export default function CausticsCube({
  position,
  size,
  color,
}: {
  position: [number, number, number];
  size: number;
  color: string;
}) {
  const { uniforms } = useWaterCaustics();

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          baseColor: { value: new THREE.Color(color) },
        },
        vertexShader: projectedCausticsVertexShader,
        fragmentShader: projectedCausticsFragmentShader,
      }),
    [uniforms, color],
  );

  return (
    <mesh position={position}>
      <boxGeometry args={[size, size, size]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
