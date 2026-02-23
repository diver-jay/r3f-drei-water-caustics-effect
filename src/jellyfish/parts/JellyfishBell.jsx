import * as THREE from "three";
import "../shaders/GelShaderMaterial";
import "../shaders/BulbShaderMaterial";

export default function JellyfishBell({
  bulbGeo,
  faintMatRef,
  bulbMatRef,
  color,
  diffuseB,
  faintColor,
}) {
  return (
    <>
      {/* Bioluminescent rim glow — hover 시 발광 강화 */}
      <mesh geometry={bulbGeo} scale={1.05}>
        <gelShaderMaterial
          ref={faintMatRef}
          diffuse={faintColor}
          opacity={0.05}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bell (주 갓) */}
      <mesh geometry={bulbGeo} scale={0.95}>
        <bulbShaderMaterial
          ref={bulbMatRef}
          diffuse={color}
          diffuseB={diffuseB}
          opacity={0.75}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}
