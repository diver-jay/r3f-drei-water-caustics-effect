{{{chunks.common}}}
uniform float stepProgress;
attribute vec3 positionPrev;
{{{chunks.color_pars_vertex}}}

varying vec3 vNormal;
varying vec2 vUv;

void main() {
  {{{chunks.color_vertex}}}
  vUv = uv;
  vec4 mvPosition = modelViewMatrix * vec4(mix(positionPrev, position, stepProgress), 1.0);
  gl_Position = projectionMatrix * mvPosition;
  {{{chunks.worldpos_vertex}}}

  vNormal = normalize(position);
}
