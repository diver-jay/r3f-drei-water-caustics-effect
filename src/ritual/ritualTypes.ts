import type * as THREE from "three";

export type ColorName = "Coral" | "Gold" | "Emerald";

export interface RitualTrigger {
  colorName: ColorName;
  position: THREE.Vector3;
}

export interface RitualBridge {
  trigger: RitualTrigger | null;
}
