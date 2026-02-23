import * as THREE from "three";
import "../shaders/TailShaderMaterial";

export default function JellyfishMouth({ mouthGeo, mouthMatRef, color, faintColor }) {
  return (
    <mesh geometry={mouthGeo}>
      <tailShaderMaterial
        ref={mouthMatRef}
        diffuse={faintColor}
        diffuseB={color}
        scale={3}
        opacity={0.75 * 0.65}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
