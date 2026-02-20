import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import bulbVertex from "../glsl/bulb.vert?raw";
import tailFragment from "../glsl/tail.frag?raw";

const parseChunks = (source) =>
  source.replace(/{{{chunks\.(\w+)}}}/g, "#include <$1>");

const TailShaderMaterialImpl = shaderMaterial(
  {
    stepProgress: 0,
    diffuse: new THREE.Color(0xe4bbee), // 라벤더 (밝은 색)
    diffuseB: new THREE.Color(0x241138), // 진한 퍼플 (어두운 색)
    opacity: 0.75,
    scale: 20,
  },
  parseChunks(bulbVertex),
  tailFragment,
);

extend({ TailShaderMaterial: TailShaderMaterialImpl });

export default TailShaderMaterialImpl;
