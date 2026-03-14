import type * as THREE from "three";

export type ColorName = "Coral" | "Gold" | "Emerald";

export const COLOR_TO_ROUTE: Record<ColorName, string> = {
  Coral: "/now",
  Gold: "/uses",
  Emerald: "/playground",
};

export interface RitualTrigger {
  colorName: ColorName;
  position: THREE.Vector3;
}

export interface RitualBridge {
  trigger: RitualTrigger | null;
}
