import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Perf } from "r3f-perf";
import * as THREE from "three";
import {
  WaterCausticsProvider,
  CausticsInteractionPlane,
  useWaterCaustics,
} from "./water-caustics";
import {
  projectedCausticsVertexShader,
  projectedCausticsFragmentShader,
  projectedTileCausticsFragmentShader,
} from "./water-caustics/shaders";

// ─── Consumer: Tile with textures + refraction ──────────────────────

function CausticsTile({
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

// ─── Consumer: Sphere with base color ───────────────────────────────

function CausticsSphere({
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

// ─── Consumer: Cube with base color ─────────────────────────────────

function CausticsCube({
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

// ─── Scene ──────────────────────────────────────────────────────────

export default function Experience() {
  return (
    <>
      <Perf position="top-left" />
      <OrbitControls makeDefault />
      <ambientLight intensity={0.5} />

      <WaterCausticsProvider position={[0, 0, 0]} size={10} enableAutoDrops>
        <CausticsInteractionPlane />
        <CausticsTile position={[0, 0, 0]} scale={10} tileRepeat={[1, 1]} />
        <CausticsSphere position={[-2, 1, 0]} radius={0.8} color="#ff6b6b" />
        <CausticsCube position={[2, 0.75, 0]} size={1.5} color="#4ecdc4" />
      </WaterCausticsProvider>
    </>
  );
}
