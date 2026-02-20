import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import gelVertex from "../glsl/gel.vert?raw";
import gelFragment from "../glsl/gel.frag?raw";

// 중괄호 구문 변환 유틸리티
const parseChunks = (source) =>
  source.replace(/{{{chunks\.(\w+)}}}/g, "#include <$1>");

const GelShaderMaterialImpl = shaderMaterial(
  {
    // [Vertex Shader용]
    stepProgress: 0,
    // [Fragment Shader용]
    diffuse: new THREE.Color("#298b39"),
    opacity: 1.0,
  },
  parseChunks(gelVertex),
  parseChunks(gelFragment),
);

extend({ GelShaderMaterial: GelShaderMaterialImpl });

export default GelShaderMaterialImpl;
