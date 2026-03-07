import * as THREE from "three";
import { JSX } from "react";
import React from "react";

interface JellyfishProps {
  color?: THREE.Color;
  diffuseB?: THREE.Color;
  faintColor?: THREE.Color;
  initialAngle?: number;
  initialPosition?: THREE.Vector3;
  onSurfaceReach?: (position: THREE.Vector3) => void;
  speed?: number;
  size?: number;
  id?: string;
  positionsMapRef?: React.MutableRefObject<Map<string, THREE.Vector3>>;
}

declare function Jellyfish(props: JellyfishProps): JSX.Element;
export default Jellyfish;
