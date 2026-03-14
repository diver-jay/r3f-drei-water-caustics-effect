import { Uniform } from "three";
import { Effect } from "postprocessing";
import type { Camera } from "three";

const WATER_SURFACE_Y = 4;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uIntensity;

vec3 N13(float p) {
  vec3 p3 = fract(vec3(p) * vec3(.1031, .11369, .13787));
  p3 += dot(p3, p3.yzx + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

float N(float t) {
  return fract(sin(t * 12345.564) * 7658.76);
}

float Saw(float b, float t) {
  return smoothstep(0., b, t) * smoothstep(1., b, t);
}

float StaticDrops(vec2 uv, float t) {
  uv *= 40.;
  vec2 id = floor(uv);
  uv = fract(uv) - .5;
  vec3 n = N13(id.x * 107.45 + id.y * 3543.654);
  vec2 p = (n.xy - .5) * .7;
  float d = length(uv - p);
  float fade = Saw(.025, fract(t + n.z));
  return smoothstep(.3, 0., d) * fract(n.z * 10.) * fade;
}

vec2 DropLayer2(vec2 uv, float t) {
  vec2 UV = uv;
  uv.y += t * 0.75;
  vec2 a = vec2(6.0, 1.0);
  vec2 grid = a * 2.0;
  vec2 id = floor(uv * grid);
  float colShift = N(id.x);
  uv.y += colShift;
  id = floor(uv * grid);
  vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
  if (n.y < 0.8) return vec2(0.0);
  vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
  float x = n.x - 0.5;
  float y = UV.y * 20.0;
  float wiggle = sin(y + sin(y));
  x += wiggle * (0.5 - abs(x)) * (n.z - 0.5);
  x *= 0.7;
  float ti = fract(t + n.z);
  y = (Saw(0.85, ti) - 0.5) * 0.9 + 0.5;
  vec2 p = vec2(x, y);
  float d = length((st - p) * a.yx);
  float mainDrop = smoothstep(0.4, 0.0, d);
  float r = sqrt(smoothstep(1.0, y, st.y));
  float cd = abs(st.x - x);
  float trail = smoothstep(0.23 * r, 0.15 * r * r, cd);
  float trailFront = smoothstep(-0.02, 0.02, st.y - y);
  trail *= trailFront * r * r;
  float y2 = UV.y;
  float trail2 = smoothstep(0.2 * r, 0.0, cd);
  float droplets = max(0.0, (sin(y2 * (1.0 - y2) * 120.0) - st.y)) * trail2 * trailFront * n.z;
  y2 = fract(y2 * 10.0) + (st.y - 0.5);
  float dd = length(st - vec2(x, y2));
  droplets = smoothstep(0.3, 0.0, dd);
  float m = mainDrop + droplets * r * trailFront;
  return vec2(m, trail);
}

vec2 Drops(vec2 uv, float t, float l0, float l1, float l2, float l3) {
  float s = StaticDrops(uv, t) * l0;
  vec2 m1 = DropLayer2(uv, t) * l1;
  vec2 m2 = DropLayer2(uv * 2.5, t) * l2;
  vec2 m3 = DropLayer2(uv * 0.6, t) * l3;
  float c = s + m1.x + m2.x + m3.x;
  c = smoothstep(.3, 1., c);
  return vec2(c, max(max(m1.y * l0, m2.y * l1), m3.y * l2));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (uIntensity <= 0.0) {
    outputColor = inputColor;
    return;
  }

  vec2 dropUv = uv * 2.0;
  float t = uTime * 0.2;

  vec2 c = Drops(dropUv, t, 0.0, 1.0, 0.8, 1.2);
  vec2 e = vec2(.001, 0.);
  float cx = Drops(dropUv + e,     t, 0.0, 1.0, 0.8, 1.2).x;
  float cy = Drops(dropUv + e.yx,  t, 0.0, 1.0, 0.8, 1.2).x;
  vec2 n = vec2(cx - c.x, cy - c.x) * uIntensity;

  outputColor = texture2D(inputBuffer, uv + n);
}
`;

export class WaterDropEffect extends Effect {
  camera: Camera | null = null;

  private _phase: "idle" | "in" | "out" = "idle";
  private _phaseTime = 0;
  private _wasUnderwater: boolean | null = null;

  constructor() {
    super("WaterDropEffect", fragmentShader, {
      uniforms: new Map([
        ["uTime", new Uniform(0)],
        ["uIntensity", new Uniform(0)],
      ]),
    });
  }

  update(_renderer: unknown, _inputBuffer: unknown, deltaTime: number) {
    this.uniforms.get("uTime")!.value += deltaTime;

    if (!this.camera) return;

    const isUnderwater = this.camera.position.y < WATER_SURFACE_Y;

    // First frame — just record state, don't trigger
    if (this._wasUnderwater === null) {
      this._wasUnderwater = isUnderwater;
      return;
    }

    if (this._wasUnderwater && !isUnderwater) {
      // Camera broke through water surface going up
      this._phase = "in";
      this._phaseTime = 0;
    } else if (!this._wasUnderwater && isUnderwater) {
      // Camera went back underwater — kill effect immediately
      this._phase = "idle";
      this._phaseTime = 0;
      this.uniforms.get("uIntensity")!.value = 0;
    }
    this._wasUnderwater = isUnderwater;

    const dt = Math.min(deltaTime, 1 / 30);

    if (this._phase === "in") {
      this._phaseTime += dt;
      this.uniforms.get("uIntensity")!.value = Math.min(1, this._phaseTime / 0.3);
      if (this._phaseTime >= 0.3) {
        this._phase = "out";
        this._phaseTime = 0;
      }
    } else if (this._phase === "out") {
      this._phaseTime += dt;
      this.uniforms.get("uIntensity")!.value = Math.max(0, 1 - this._phaseTime / 2.5);
      if (this._phaseTime >= 2.5) {
        this._phase = "idle";
      }
    }
  }
}
