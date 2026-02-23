import "../shaders/TentacleShaderMaterial";

export default function JellyfishTentacles({ tentGeo, tentMatRef, faintColor }) {
  return (
    <lineSegments geometry={tentGeo}>
      <tentacleShaderMaterial
        ref={tentMatRef}
        diffuse={faintColor}
        area={2000}
        opacity={0.25}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </lineSegments>
  );
}
