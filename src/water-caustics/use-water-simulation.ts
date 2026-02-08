import { useMemo, useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  vertexShader,
  dropFragmentShader,
  updateFragmentShader,
  normalFragmentShader,
} from "./shaders";

export function useWaterSimulation(resolution = 256, enableAutoDrops = true) {
  const { gl } = useThree();
  const lastDropTime = useRef(0);

  const simulation = useMemo(() => {
    // Create render targets for ping-pong buffer
    const options = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
    };

    const textureA = new THREE.WebGLRenderTarget(
      resolution,
      resolution,
      options,
    );
    const textureB = new THREE.WebGLRenderTarget(
      resolution,
      resolution,
      options,
    );

    // Scene and camera for off-screen rendering
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry);
    scene.add(mesh);

    // Drop material - adds ripples
    const dropMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterTexture: { value: null },
        center: { value: new THREE.Vector2() },
        radius: { value: 0.03 },
        strength: { value: 0.3 },
      },
      vertexShader,
      fragmentShader: dropFragmentShader,
    });

    // Update material - wave propagation
    const updateMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterTexture: { value: null },
        delta: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
      },
      vertexShader,
      fragmentShader: updateFragmentShader,
    });

    // Normal material - calculate normals
    const normalMaterial = new THREE.ShaderMaterial({
      uniforms: {
        waterTexture: { value: null },
        delta: { value: new THREE.Vector2(1 / resolution, 1 / resolution) },
      },
      vertexShader,
      fragmentShader: normalFragmentShader,
    });

    return {
      textureA,
      textureB,
      scene,
      camera,
      mesh,
      dropMaterial,
      updateMaterial,
      normalMaterial,
      currentTexture: 0,
    };
  }, [resolution]);

  // Add a drop at position (x, y) in normalized coordinates (-1 to 1)
  const addDrop = useCallback(
    (x: number, y: number, radius = 0.03, strength = 0.3) => {
      const { scene, camera, mesh, dropMaterial, textureA, textureB } =
        simulation;
      const source = simulation.currentTexture === 0 ? textureA : textureB;
      const target = simulation.currentTexture === 0 ? textureB : textureA;

      dropMaterial.uniforms.waterTexture.value = source.texture;
      dropMaterial.uniforms.center.value.set(x, y);
      dropMaterial.uniforms.radius.value = radius;
      dropMaterial.uniforms.strength.value = strength;
      mesh.material = dropMaterial;

      gl.setRenderTarget(target);
      gl.render(scene, camera);
      gl.setRenderTarget(null);

      simulation.currentTexture = 1 - simulation.currentTexture;
    },
    [simulation, gl],
  );

  // Update the simulation
  const update = () => {
    const {
      scene,
      camera,
      mesh,
      updateMaterial,
      normalMaterial,
      textureA,
      textureB,
    } = simulation;
    const source = simulation.currentTexture === 0 ? textureA : textureB;
    const target = simulation.currentTexture === 0 ? textureB : textureA;

    // Wave propagation
    updateMaterial.uniforms.waterTexture.value = source.texture;
    mesh.material = updateMaterial;

    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    simulation.currentTexture = 1 - simulation.currentTexture;

    // Calculate normals
    const newSource = simulation.currentTexture === 0 ? textureA : textureB;
    const newTarget = simulation.currentTexture === 0 ? textureB : textureA;

    normalMaterial.uniforms.waterTexture.value = newSource.texture;
    mesh.material = normalMaterial;

    gl.setRenderTarget(newTarget);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    simulation.currentTexture = 1 - simulation.currentTexture;
  };

  // Auto-drop and update in animation loop
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Add random drops periodically (if enabled)
    if (enableAutoDrops && time - lastDropTime.current > 0.8) {
      const x = (Math.random() - 0.5) * 1.5;
      const y = (Math.random() - 0.5) * 1.5;
      addDrop(x, y, 0.03 + Math.random() * 0.02, 0.2 + Math.random() * 0.2);
      lastDropTime.current = time;
    }

    // Update simulation
    update();
  });

  // Get current texture for rendering
  const getTexture = () => {
    const { textureA, textureB } = simulation;
    return simulation.currentTexture === 0
      ? textureA.texture
      : textureB.texture;
  };

  return { getTexture, addDrop };
}
