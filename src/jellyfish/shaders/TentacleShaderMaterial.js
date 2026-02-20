import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import tentacleVertex from "../glsl/tentacle.vert?raw";
import tentacleFragment from "../glsl/tentacle.frag?raw";

const parseChunks = (source) =>
  source.replace(/{{{chunks\.(\w+)}}}/g, "#include <$1>");

const TentacleShaderMaterialImpl = shaderMaterial(
  {
    stepProgress: 0,
    diffuse: new THREE.Color(0xffdde9), // 따뜻한 핑크-흰
    opacity: 0.35,
    area: 1200,
  },
  parseChunks(tentacleVertex),
  parseChunks(tentacleFragment),
);

extend({ TentacleShaderMaterial: TentacleShaderMaterialImpl });

export default TentacleShaderMaterialImpl;
