{{{chunks.common}}}
uniform float stepProgress;
attribute vec3 positionPrev;
{{{chunks.color_pars_vertex}}}

varying float centerDist;

void main() {
  {{{chunks.color_vertex}}}
  vec3 lerpedPos = mix(positionPrev, position, stepProgress);
  centerDist = length(lerpedPos);
  vec4 mvPosition = modelViewMatrix * vec4(lerpedPos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  {{{chunks.worldpos_vertex}}}
}
