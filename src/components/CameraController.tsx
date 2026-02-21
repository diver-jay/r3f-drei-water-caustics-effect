import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const FLOOR_Y = 0.1;

export default function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useFrame(({ camera }) => {
    if (camera.position.y < FLOOR_Y) {
      camera.position.y = FLOOR_Y;
      controlsRef.current?.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      target={[0, 2.5, 0]}
    />
  );
}
