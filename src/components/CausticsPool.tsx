import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useWaterCaustics } from "../water-caustics";
import {
  poolCausticsVertexShader,
  poolCausticsFragmentShader,
} from "../water-caustics/shaders";

export default function CausticsPool({
  position,
  size,
  wallHeight = 5,
  tileRepeat = [1, 1],
}: {
  position: [number, number, number];
  size: number;
  wallHeight?: number;
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
          wallHeight: { value: wallHeight },
        },
        vertexShader: poolCausticsVertexShader,
        fragmentShader: poolCausticsFragmentShader,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
      }),
    [
      uniforms,
      tileColorTex,
      tileNormalTex,
      tileRoughnessTex,
      tileRepeat,
      wallHeight,
    ],
  );

  // Position the box so its bottom sits at position.y
  const boxPosition: [number, number, number] = [
    position[0],
    position[1] + wallHeight / 2,
    position[2],
  ];

  return (
    <mesh position={boxPosition}>
      <boxGeometry args={[size, wallHeight, size]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}
