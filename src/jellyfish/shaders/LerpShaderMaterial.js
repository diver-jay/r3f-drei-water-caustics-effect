import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import lerpVertex from "../glsl/lerp.vert?raw";
import lerpFragment from "../glsl/lerp.frag?raw";

const parseChunks = (source) =>
  source.replace(/{{{chunks\.(\w+)}}}/g, "#include <$1>");

const LerpShaderMaterialImpl = shaderMaterial(
  {
    stepProgress: 0,
    diffuse: new THREE.Color(0xf99ebd), // 핑크-화이트
    opacity: 0.15,
  },
  parseChunks(lerpVertex),
  lerpFragment,
);

extend({ LerpShaderMaterial: LerpShaderMaterialImpl });

export default LerpShaderMaterialImpl;
