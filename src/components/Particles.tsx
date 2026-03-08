import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 600;
const RADIUS = 1.0;

// ─── Shaders ──────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  attribute float particleT;         // azimuth seed [0, 2π]
  attribute float particleRadius;    // radial factor [0.8, 1.2]
  attribute float particleElevation; // elevation cos [-1, 1] — uniform sphere
  attribute float particleSpeed;     // drift speed [0.8, 1.2]
  attribute float particleLayer;     // layer 0, 1, 2
  attribute float particleThreshold; // appears when charge > threshold [0, 1]

  uniform vec3  centerPos;
  uniform float charge;
  uniform float time;
  uniform float radius;

  varying float vAlpha;

  void main() {
    float layerR = 0.70 + particleLayer * 0.15; // 0.70, 0.85, 1.00

    // Spherical coords — fixed radius, slow azimuth drift
    float phi  = particleT + time * particleSpeed * 0.15;
    float cosT = particleElevation;
    float sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
    float r    = radius * layerR * particleRadius;

    vec3 pos = centerPos + r * vec3(sinT * cos(phi), cosT, sinT * sin(phi));

    // Each particle fades in when charge crosses its own threshold
    float visibility = smoothstep(particleThreshold - 0.05, particleThreshold + 0.05, charge);

    // Irregular twinkle: product of two sines at different frequencies + phases
    float twinkle = abs(sin(time * 3.5 + particleT))
                  * abs(sin(time * 1.3 + particleT * 2.3));
    vAlpha = visibility * (0.1 + 0.9 * twinkle);

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = max(2.0, 80.0 / -mvPosition.z);
    gl_Position  = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 particleColor;
  varying float vAlpha;

  void main() {
    vec2  uv = gl_PointCoord - 0.5;
    float d  = length(uv) * 2.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(particleColor, vAlpha * (1.0 - d * d));
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  positionsMapRef: React.MutableRefObject<Map<string, THREE.Vector3>>;
  targetId: string;
  chargeRef: { value: number };
  color: THREE.Color;
}

export default function Particles({
  positionsMapRef,
  targetId,
  chargeRef,
  color,
}: Props) {
  const smoothChargeRef = useRef(0);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const t         = new Float32Array(PARTICLE_COUNT);
    const radius    = new Float32Array(PARTICLE_COUNT);
    const elevation = new Float32Array(PARTICLE_COUNT);
    const speed     = new Float32Array(PARTICLE_COUNT);
    const layer     = new Float32Array(PARTICLE_COUNT);
    const threshold = new Float32Array(PARTICLE_COUNT);
    const pos       = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      t[i]         = Math.random() * Math.PI * 2; // azimuth
      radius[i]    = 0.8 + Math.random() * 0.4;
      elevation[i] = Math.random() * 2 - 1;       // uniform sphere [-1, 1]
      speed[i]     = 0.8 + Math.random() * 0.4;
      layer[i]     = i % 3;
      threshold[i] = Math.random();               // appears at different charge levels
    }

    geo.setAttribute("position",          new THREE.BufferAttribute(pos,       3));
    geo.setAttribute("particleT",         new THREE.BufferAttribute(t,         1));
    geo.setAttribute("particleRadius",    new THREE.BufferAttribute(radius,    1));
    geo.setAttribute("particleElevation", new THREE.BufferAttribute(elevation, 1));
    geo.setAttribute("particleSpeed",     new THREE.BufferAttribute(speed,     1));
    geo.setAttribute("particleLayer",     new THREE.BufferAttribute(layer,     1));
    geo.setAttribute("particleThreshold", new THREE.BufferAttribute(threshold, 1));

    return geo;
  }, []);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          centerPos:     { value: new THREE.Vector3() },
          charge:        { value: 0 },
          time:          { value: 0 },
          radius:        { value: RADIUS },
          particleColor: { value: color.clone() },
        },
        transparent: true,
        depthWrite:  false,
        blending:    THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ clock }, delta) => {
    const pos = positionsMapRef.current.get(targetId);
    if (!pos) return;

    // Smooth charge: lerp toward actual value so jumps (clicks) animate smoothly
    smoothChargeRef.current +=
      (chargeRef.value - smoothChargeRef.current) * Math.min(1, 3.0 * delta);

    const u = material.uniforms;
    u.centerPos.value.copy(pos);
    u.charge.value = smoothChargeRef.current;
    u.time.value   = clock.getElapsedTime();
  });

  return (
    <points geometry={geometry} material={material} frustumCulled={false} />
  );
}
