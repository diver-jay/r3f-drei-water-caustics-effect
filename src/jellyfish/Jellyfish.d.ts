import * as THREE from "three";
import { JSX } from "react";

interface JellyfishProps {
  color?: THREE.Color;
  diffuseB?: THREE.Color;
  faintColor?: THREE.Color;
  initialAngle?: number;
  initialPosition?: THREE.Vector3;
  onSurfaceReach?: (position: THREE.Vector3) => void;
}

declare function Jellyfish(props: JellyfishProps): JSX.Element;
export default Jellyfish;
