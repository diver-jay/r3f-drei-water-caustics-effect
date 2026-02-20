import * as THREE from "three";
import { extend } from "@react-three/fiber";
import { shaderMaterial } from "@react-three/drei";
import bulbVertex from "../glsl/bulb.vert?raw";
import bulbFragment from "../glsl/bulb.frag?raw";

const parseChunks = (source) =>
  source.replace(/{{{chunks\.(\w+)}}}/g, "#include <$1>");

const BulbShaderMaterialImpl = shaderMaterial(
  {
    stepProgress: 0,
    diffuse:  new THREE.Color(0xffa9d2), // Hood Primary (핑크)
    diffuseB: new THREE.Color(0x70256c), // Hood Secondary (다크 퍼플)
    opacity: 0.75,
    time: 0,
  },
  parseChunks(bulbVertex),
  parseChunks(bulbFragment),
);

extend({ BulbShaderMaterial: BulbShaderMaterialImpl });

export default BulbShaderMaterialImpl;
