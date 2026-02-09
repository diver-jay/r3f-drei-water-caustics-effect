import { useMemo } from "react";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
} from "../water-caustics/shaders";

export default function CausticsSphere({
  position,
  radius,
  color,
}: {
  position: [number, number, number];
  radius: number;
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
      <sphereGeometry args={[radius, 32, 32]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
