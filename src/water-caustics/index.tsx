import { useRef, useCallback, useMemo } from "react";
import { useFrame, useLoader, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useWaterSimulation } from "./use-water-simulation";
import { causticsVertexShader, causticsFragmentShader } from "./shaders";

/**
 * Props for the WaterCaustics component.
 */
interface WaterCausticsProps {
  /**
   * The position of the water plane in 3D space.
   * @default [0, 0, 0]
   */
  position?: [number, number, number];
  /**
   * The uniform scale factor for the water plane.
   * A larger value makes the water plane bigger.
   * @default 10
   */
  scale?: number;
  /**
   * Enables or disables interaction with the mouse/pointer to create ripples.
   * When true, moving and clicking the mouse on the water surface will generate waves.
   * @default true
   */
  enableMouseInteraction?: boolean;
  /**
   * Enables or disables automatic, random water drops over time.
   * When true, the water surface will periodically generate small drops without user interaction.
   * @default true
   */
  enableAutoDrops?: boolean;
  /**
   * Defines how many times the `tileColor`, `tileNormal`, and `tileRoughness` textures
   * should repeat across the X and Y axes of the water plane.
   * For example, `[4, 4]` means the textures will repeat 4 times horizontally and 4 times vertically.
   * @default [1, 1]
   */
  tileRepeat?: [number, number];
}

export default function WaterCaustics({
  position = [0, 0, 0],
  scale = 10,
  enableMouseInteraction = true,
  enableAutoDrops = true,
  tileRepeat = [1, 1],
}: WaterCausticsProps) {
  const meshRef = useRef();
  const lastMouseDrop = useRef(0);
  const { getTexture, addDrop } = useWaterSimulation(256, enableAutoDrops);

  // Load tile textures
  const [tileColorTex, tileNormalTex, tileRoughnessTex] = useLoader(
    THREE.TextureLoader,
    ["/tiles_color.jpg", "/tiles_normal.jpg", "/tiles_roughness.jpg"],
  );

  // Configure texture wrapping for repeat
  useMemo(() => {
    [tileColorTex, tileNormalTex, tileRoughnessTex].forEach((tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    });
  }, [tileColorTex, tileNormalTex, tileRoughnessTex]);

  // Create shader material
  const shaderMaterial = useRef(
    new THREE.ShaderMaterial({
      uniforms: {
        waterTexture: { value: null },
        tileColor: { value: null },
        tileNormal: { value: null },
        tileRoughness: { value: null },
        chromaticAberration: { value: 0.005 },
        time: { value: 0 },
        rotationAngle: { value: 0 },
        tileRepeat: { value: new THREE.Vector2(tileRepeat[0], tileRepeat[1]) },
      },
      vertexShader: causticsVertexShader,
      fragmentShader: causticsFragmentShader,
      side: THREE.DoubleSide,
    }),
  ).current;

  // Handle mouse/pointer move
  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enableMouseInteraction) return;

      const now = performance.now();
      // Throttle drops to every 50ms
      if (now - lastMouseDrop.current < 50) return;
      lastMouseDrop.current = now;

      // Get UV coordinates from intersection
      if (event.uv) {
        // Convert UV (0-1) to simulation coordinates (-1 to 1)
        const x = (event.uv.x - 0.5) * 2;
        const y = (event.uv.y - 0.5) * 2;
        addDrop(x, y, 0.02, 0.15);
      }
    },
    [enableMouseInteraction, addDrop],
  );

  // Handle click for bigger drops
  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (!enableMouseInteraction) return;

      if (event.uv) {
        const x = (event.uv.x - 0.5) * 2;
        const y = (event.uv.y - 0.5) * 2;
        addDrop(x, y, 0.04, 0.4);
      }
    },
    [enableMouseInteraction, addDrop],
  );

  useFrame((state) => {
    // Update uniforms
    shaderMaterial.uniforms.waterTexture.value = getTexture();
    shaderMaterial.uniforms.tileColor.value = tileColorTex;
    shaderMaterial.uniforms.tileNormal.value = tileNormalTex;
    shaderMaterial.uniforms.tileRoughness.value = tileRoughnessTex;
    shaderMaterial.uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={[-Math.PI * 0.5, 0, 0]}
      scale={scale}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      <primitive object={shaderMaterial} attach="material" />
    </mesh>
  );
}
