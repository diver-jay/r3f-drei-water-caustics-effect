import * as THREE from "three";
import { JSX } from "react";

interface JellyfishProps {
  colors?: {
    base?: THREE.Color;
    dark?: THREE.Color;
    glow?: THREE.Color;
  };
  initial?: {
    azimuth?: number;
    position?: THREE.Vector3;
  };
  speed?: number;
  size?: number;
  onPositionUpdate?: (position: THREE.Vector3) => void;
  onSurfaceReach?: (position: THREE.Vector3) => void;
  connectionGlowRef?: { value: number };
  chargeRef?: { value: number };
}

declare function Jellyfish(props: JellyfishProps): JSX.Element;
export default Jellyfish;
