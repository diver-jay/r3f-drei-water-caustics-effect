import * as THREE from "three";
import "../shaders/TentacleShaderMaterial";

export default function JellyfishHood({ linksGeo, hoodMatRef, color }) {
  return (
    <lineSegments geometry={linksGeo}>
      <tentacleShaderMaterial
        ref={hoodMatRef}
        diffuse={color}
        opacity={0.35}
        transparent
        blending={THREE.AdditiveBlending}
        depthTest={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}
