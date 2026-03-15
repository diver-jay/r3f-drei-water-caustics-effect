import type * as THREE from "three";

export type ColorName = "Coral" | "Gold" | "Emerald";

export const COLOR_TO_ROUTE: Record<ColorName, string> = {
  Coral: "https://www.linkedin.com/in/jun-hong-lee-b694232b4/?locale=ko",
  Gold: "/uses",
  Emerald: "/about-me",
};

export interface RitualTrigger {
  colorName: ColorName;
  position: THREE.Vector3;
}

export interface RitualBridge {
  trigger: RitualTrigger | null;
}
