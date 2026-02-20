{{{chunks.common}}}
uniform float stepProgress;
attribute vec3 positionPrev;
{{{chunks.color_pars_vertex}}}

void main() {
  {{{chunks.color_vertex}}}
  vec3 lerpedPos = mix(positionPrev, position, stepProgress);
  vec4 mvPosition = modelViewMatrix * vec4(lerpedPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  {{{chunks.worldpos_vertex}}}
}
