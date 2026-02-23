import * as THREE from "three";
import "../shaders/TailShaderMaterial";

export default function JellyfishTail({ tailGeo, tailMatRef, color, faintColor }) {
  return (
    <mesh geometry={tailGeo} scale={0.95}>
      <tailShaderMaterial
        ref={tailMatRef}
        diffuse={faintColor}
        diffuseB={color}
        scale={3}
        opacity={0.55}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
