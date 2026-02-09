import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";
import {
  projectedCausticsVertexShader,
  projectedTileCausticsFragmentShader,
} from "../water-caustics/shaders";

export default function CausticsTile({
  position,
  scale,
  tileRepeat = [1, 1],
}: {
  position: [number, number, number];
  scale: number;
  tileRepeat?: [number, number];
}) {
  const { uniforms } = useWaterCaustics();

  const [tileColorTex, tileNormalTex, tileRoughnessTex] = useLoader(
    THREE.TextureLoader,
    ["/tiles_color.jpg", "/tiles_normal.jpg", "/tiles_roughness.jpg"],
  );

  useMemo(() => {
    [tileColorTex, tileNormalTex, tileRoughnessTex].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }, [tileColorTex, tileNormalTex, tileRoughnessTex]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          ...uniforms,
          tileColor: { value: tileColorTex },
          tileNormal: { value: tileNormalTex },
          tileRoughness: { value: tileRoughnessTex },
          tileRepeat: {
            value: new THREE.Vector2(tileRepeat[0], tileRepeat[1]),
          },
        },
        vertexShader: projectedCausticsVertexShader,
        fragmentShader: projectedTileCausticsFragmentShader,
        side: THREE.DoubleSide,
      }),
    [uniforms, tileColorTex, tileNormalTex, tileRoughnessTex, tileRepeat],
  );

  return (
    <mesh
      position={position}
      rotation={[-Math.PI * 0.5, 0, 0]}
      scale={scale}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
