import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import buildJellyfish, { updateRibs } from "./build";
import "./shaders/GelShaderMaterial";
import "./shaders/BulbShaderMaterial";
import "./shaders/TailShaderMaterial";
import "./shaders/TentacleShaderMaterial";
import "./shaders/LerpShaderMaterial";
import JellyfishBell from "./parts/JellyfishBell";
import JellyfishTail from "./parts/JellyfishTail";
import JellyfishHood from "./parts/JellyfishHood";
import JellyfishTentacles from "./parts/JellyfishTentacles";
import JellyfishMouth from "./parts/JellyfishMouth";

const { sin, cos, PI } = Math;

// ─── Swimming constants ────────────────────────────────────────────────────────
const THRUST_FACTOR = 2.0;
const GRAVITY = 0.06;
const TURN_SPEED = 0.7;
const WANDER_MIN = 3.5;
const WANDER_MAX = 7.0;
const BOUNDS_XZ = 3.0;
const BOUNDS_Y_MIN = 0.8;
const BOUNDS_Y_MAX = 3.2;
const REPEL = 1.2;
const SURFACE_Y = 2.0;

// ─── Jellyfish Component ──────────────────────────────────────────────────────
export default function Jellyfish({
  color = new THREE.Color(0xff6b6b),
  diffuseB: diffuseBProp = new THREE.Color(0x7a1a1a),
  faintColor = new THREE.Color(0xff4444),
  initialAngle = 0,
  initialPosition = new THREE.Vector3(0, 1.5, 0),
  onSurfaceReach = () => {},
}) {
  const animTimeRef = useRef(Math.random() * 2.5);
  const groupRef = useRef();
  const prevPhaseRef = useRef(0);
  const isHoveredRef = useRef(false);
  const isSurfacingRef = useRef(false);

  // ── 3D swimming state ────────────────────────────────────────────────────────
  const swimPosRef = useRef(initialPosition.clone());
  const swimVelRef = useRef(new THREE.Vector3());
  const wanderAngleRef = useRef(initialAngle);
  const _initPitch = (Math.random() - 0.5) * PI * 0.8;
  const wanderPitchRef = useRef(_initPitch);
  const wanderTargetAngleRef = useRef(
    initialAngle + (Math.random() - 0.5) * 1.2,
  );
  const wanderTargetPitchRef = useRef(_initPitch + (Math.random() - 0.5) * 0.8);
  const wanderTimerRef = useRef(2 + Math.random() * 3);
  const swimDirRef = useRef(
    new THREE.Vector3(
      cos(_initPitch) * cos(initialAngle),
      sin(_initPitch),
      cos(_initPitch) * sin(initialAngle),
    ),
  );

  // Reusable scratch objects — no allocation in useFrame
  const _targetQuatRef = useRef(new THREE.Quaternion());
  const _invQuatRef = useRef(new THREE.Quaternion());
  const _velModelRef = useRef(new THREE.Vector3());
  const _rightVecRef = useRef(new THREE.Vector3(1, 0, 0));
  const _forwardVecRef = useRef(new THREE.Vector3(0, 0, 1));
  const _matrixRef = useRef(new THREE.Matrix4());

  // Material refs
  const bulbMatRef = useRef();
  const faintMatRef = useRef();
  const tailMatRef = useRef();
  const hoodMatRef = useRef();
  const tentMatRef = useRef();
  const mouthMatRef = useRef();

  const hoverLerpRef = useRef(0);
  const hitRef = useRef(0);

  // HDR-boosted hover colors
  const hoverColorHDR = useMemo(
    () => new THREE.Color(color.r * 2.5, color.g * 2.5, color.b * 2.5),
    [color],
  );
  const hoverFaintColorHDR = useMemo(
    () =>
      new THREE.Color(
        faintColor.r * 4.0,
        faintColor.g * 4.0,
        faintColor.b * 4.0,
      ),
    [faintColor],
  );
  const hoverDiffuseBColor = useMemo(
    () => new THREE.Color().lerpColors(diffuseBProp, new THREE.Color(1, 1, 1), 0.3),
    [diffuseBProp],
  );

  const {
    system,
    gravityForce,
    ribs,
    tailRibs,
    links,
    tentLinks,
    bulbFaces,
    tailFaces,
    mouthFaces,
    uvs,
    totalSegments,
    tentacles,
  } = useMemo(() => buildJellyfish(), []);

  function makeGeo(faces) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(system.positions, 3),
    );
    geo.setAttribute(
      "positionPrev",
      new THREE.BufferAttribute(system.positionsPrev, 3),
    );
    geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(faces), 1));
    return geo;
  }

  const bulbGeo = useMemo(() => {
    const g = makeGeo(bulbFaces);
    g.computeVertexNormals();
    return g;
  }, [system, bulbFaces, uvs]);
  const tailGeo = useMemo(() => makeGeo(tailFaces), [system, tailFaces, uvs]);
  const linksGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(system.positions, 3));
    g.setAttribute(
      "positionPrev",
      new THREE.BufferAttribute(system.positionsPrev, 3),
    );
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(links), 1));
    return g;
  }, [system, links]);
  const tentGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(system.positions, 3));
    g.setAttribute(
      "positionPrev",
      new THREE.BufferAttribute(system.positionsPrev, 3),
    );
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(tentLinks), 1));
    return g;
  }, [system, tentLinks]);
  const mouthGeo = useMemo(
    () => makeGeo(mouthFaces),
    [system, mouthFaces, uvs],
  );

  // ── useFrame sub-functions (close over refs) ──────────────────────────────

  // Bell pulse phase (asymmetric: expand slow 75%, contract fast 25%)
  function tickPulse(clampedDelta) {
    const PERIOD = 2.5, EXPAND_RATIO = 0.75;
    const t = (animTimeRef.current += clampedDelta);
    const cycleT = (t % PERIOD) / PERIOD;
    let phase;
    if (cycleT < EXPAND_RATIO) {
      phase = (sin((cycleT / EXPAND_RATIO) * PI - PI * 0.5) + 1) * 0.5;
    } else {
      phase =
        1 -
        (sin(
          ((cycleT - EXPAND_RATIO) / (1 - EXPAND_RATIO)) * PI - PI * 0.5,
        ) +
          1) *
          0.5;
    }
    hitRef.current *= Math.pow(0.003, clampedDelta);
    const displayPhase = Math.max(0, phase - hitRef.current);
    return { t, phase, displayPhase };
  }

  // Swimming: impulse, drag, wander, gravity, boundary repulsion, position update
  function tickSwim(clampedDelta, phase) {
    const phaseDelta = phase - prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const isContracting = phaseDelta < 0;
    if (isContracting) {
      const impulse = Math.abs(phaseDelta) * THRUST_FACTOR;
      swimVelRef.current.addScaledVector(swimDirRef.current, impulse);
    }

    const dragPerSec = isContracting ? 0.85 : 0.4;
    swimVelRef.current.multiplyScalar(Math.pow(dragPerSec, clampedDelta));

    if (!isSurfacingRef.current) {
      swimVelRef.current.y -= GRAVITY * clampedDelta;

      // Wander: pick new target direction periodically
      wanderTimerRef.current -= clampedDelta;
      if (wanderTimerRef.current <= 0) {
        wanderAngleRef.current =
          ((wanderAngleRef.current % (PI * 2)) + PI * 2) % (PI * 2);
        wanderPitchRef.current = Math.max(
          -PI * 0.45,
          Math.min(PI * 0.45, wanderPitchRef.current),
        );
        wanderTargetAngleRef.current =
          wanderAngleRef.current + (Math.random() - 0.5) * PI * 1.2;
        wanderTargetPitchRef.current = Math.max(
          -PI * 0.45,
          Math.min(
            PI * 0.45,
            wanderPitchRef.current + (Math.random() - 0.5) * PI * 0.7,
          ),
        );
        wanderTimerRef.current =
          WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
      }

      // Steer toward target (shortest-path angle interpolation)
      const rawAngleDiff =
        wanderTargetAngleRef.current - wanderAngleRef.current;
      const shortAngleDiff =
        rawAngleDiff - Math.round(rawAngleDiff / (PI * 2)) * (PI * 2);
      wanderAngleRef.current += shortAngleDiff * TURN_SPEED * clampedDelta;
      wanderPitchRef.current +=
        (wanderTargetPitchRef.current - wanderPitchRef.current) *
        TURN_SPEED *
        clampedDelta;

      const a = wanderAngleRef.current,
        p = wanderPitchRef.current;
      const cp = cos(p);
      swimDirRef.current.set(cp * cos(a), sin(p), cp * sin(a)).normalize();
    } else {
      swimDirRef.current.set(0, 1, 0);
      swimVelRef.current.y += 3.0 * clampedDelta;
    }

    // Boundary repulsion + position update
    const pos = swimPosRef.current;
    const vel = swimVelRef.current;
    if (pos.x > BOUNDS_XZ) vel.x -= REPEL * clampedDelta;
    if (pos.x < -BOUNDS_XZ) vel.x += REPEL * clampedDelta;
    if (pos.z > BOUNDS_XZ) vel.z -= REPEL * clampedDelta;
    if (pos.z < -BOUNDS_XZ) vel.z += REPEL * clampedDelta;
    if (pos.y < BOUNDS_Y_MIN) vel.y += REPEL * clampedDelta;
    if (pos.y > BOUNDS_Y_MAX) vel.y -= REPEL * clampedDelta;
    pos.addScaledVector(vel, clampedDelta);
    pos.x = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.x));
    pos.z = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.z));
    pos.y = Math.max(BOUNDS_Y_MIN - 0.2, Math.min(BOUNDS_Y_MAX + 0.5, pos.y));
  }

  // Orient group to face swimDir (roll-free basis matrix)
  function tickGroupTransform(clampedDelta, group) {
    group.position.copy(swimPosRef.current);

    const dirX = swimDirRef.current.x;
    const dirZ = swimDirRef.current.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len > 0.0001) {
      _rightVecRef.current.set(dirZ / len, 0, -dirX / len);
    }
    _forwardVecRef.current
      .crossVectors(_rightVecRef.current, swimDirRef.current)
      .normalize();
    _matrixRef.current.makeBasis(
      _rightVecRef.current,
      swimDirRef.current,
      _forwardVecRef.current,
    );
    _targetQuatRef.current.setFromRotationMatrix(_matrixRef.current);
    group.quaternion.slerp(
      _targetQuatRef.current,
      1 - Math.exp(-1.5 * clampedDelta),
    );
  }

  // Detect surface arrival and reset back to swimming
  function tickSurface() {
    const pos = swimPosRef.current;
    const vel = swimVelRef.current;
    if (isSurfacingRef.current && pos.y >= SURFACE_Y) {
      onSurfaceReach(new THREE.Vector3(pos.x, 5, pos.z));
      isSurfacingRef.current = false;
      pos.set(pos.x, initialPosition.y, pos.z);
      vel.set(0, 0, 0);
      wanderAngleRef.current = initialAngle;
      wanderPitchRef.current = 0;
      swimDirRef.current.set(cos(initialAngle), 0, sin(initialAngle));
    }
  }

  // Particulate physics step (gravity, ribs, tentacle drag, integrate, verlet damping)
  function tickPhysics(clampedDelta, phase, displayPhase, group) {
    gravityForce.set(
      0,
      -2 - phase * 3 - Math.max(0, swimVelRef.current.y) * 1.5,
      0,
    );
    updateRibs(ribs, displayPhase, totalSegments);
    updateRibs(tailRibs, displayPhase, totalSegments);

    // Tentacle drag: inject world-space velocity as model-space force
    _invQuatRef.current.copy(group.quaternion).invert();
    _velModelRef.current
      .copy(swimVelRef.current)
      .applyQuaternion(_invQuatRef.current);
    const vmx = _velModelRef.current.x;
    const vmy = _velModelRef.current.y;
    const vmz = _velModelRef.current.z;

    const tentStart = tentacles[0][0].start;
    const tentEnd = tentacles[0][tentacles[0].length - 1].start + totalSegments;
    system.accumulateForces(clampedDelta);
    const af = system.accumulatedForces;
    const DRAG = 15.0;
    for (let i = tentStart; i < tentEnd; i++) {
      const ix = i * 3;
      af[ix] -= vmx * DRAG;
      af[ix + 1] -= vmy * DRAG;
      af[ix + 2] -= vmz * DRAG;
    }
    system.integrate(clampedDelta);
    system.satisfyConstraints();

    // Verlet velocity damping
    const keepFraction = Math.pow(0.82, clampedDelta);
    const p = system.positions;
    const pp = system.positionsPrev;
    for (let i = 0, n = p.length; i < n; i++) {
      pp[i] += (p[i] - pp[i]) * (1 - keepFraction);
    }
  }

  // Flag geometry buffers dirty for GPU upload
  function markGeosDirty() {
    bulbGeo.attributes.position.needsUpdate = true;
    bulbGeo.attributes.positionPrev.needsUpdate = true;
    bulbGeo.computeVertexNormals();
    tailGeo.attributes.position.needsUpdate = true;
    tailGeo.attributes.positionPrev.needsUpdate = true;
    linksGeo.attributes.position.needsUpdate = true;
    linksGeo.attributes.positionPrev.needsUpdate = true;
    tentGeo.attributes.position.needsUpdate = true;
    tentGeo.attributes.positionPrev.needsUpdate = true;
    mouthGeo.attributes.position.needsUpdate = true;
    mouthGeo.attributes.positionPrev.needsUpdate = true;
  }

  // Update shader uniforms: stepProgress, hover color lerp, bioluminescence opacity
  function updateMaterials(displayPhase, t, delta) {
    if (bulbMatRef.current) {
      bulbMatRef.current.stepProgress = displayPhase;
      bulbMatRef.current.time = t;
    }
    if (faintMatRef.current) {
      faintMatRef.current.stepProgress = displayPhase;
      const targetOpacity = isHoveredRef.current ? 0.7 : 0.05;
      faintMatRef.current.opacity +=
        (targetOpacity - faintMatRef.current.opacity) * 5 * delta;
    }
    if (tailMatRef.current) tailMatRef.current.stepProgress = displayPhase;
    if (hoodMatRef.current) hoodMatRef.current.stepProgress = displayPhase;
    if (tentMatRef.current) tentMatRef.current.stepProgress = displayPhase;
    if (mouthMatRef.current) mouthMatRef.current.stepProgress = displayPhase;

    const targetLerp = isHoveredRef.current ? 1 : 0;
    hoverLerpRef.current += (targetLerp - hoverLerpRef.current) * 5 * delta;
    const h = hoverLerpRef.current;
    if (bulbMatRef.current) {
      bulbMatRef.current.diffuse.lerpColors(color, hoverColorHDR, h);
      bulbMatRef.current.diffuseB.lerpColors(diffuseBProp, hoverDiffuseBColor, h);
      bulbMatRef.current.opacity = 0.75 + h * 0.2;
    }
    if (tailMatRef.current) {
      tailMatRef.current.diffuse.lerpColors(faintColor, hoverFaintColorHDR, h);
      tailMatRef.current.diffuseB.lerpColors(color, hoverColorHDR, h);
      tailMatRef.current.opacity = 0.55 + h * 0.2;
    }
    if (hoodMatRef.current) {
      hoodMatRef.current.diffuse.lerpColors(color, hoverColorHDR, h);
      hoodMatRef.current.opacity = 0.35 + h * 0.55;
    }
    if (tentMatRef.current) {
      tentMatRef.current.diffuse.lerpColors(faintColor, hoverFaintColorHDR, h);
    }
    if (mouthMatRef.current) {
      mouthMatRef.current.diffuse.lerpColors(faintColor, hoverFaintColorHDR, h);
      mouthMatRef.current.diffuseB.lerpColors(color, hoverColorHDR, h);
    }
  }

  useFrame((_, delta) => {
    const clampedDelta = Math.min(delta, 1 / 30) || 0;
    const { t, phase, displayPhase } = tickPulse(clampedDelta);
    tickSwim(clampedDelta, phase);
    const group = groupRef.current;
    if (!group) return;
    tickGroupTransform(clampedDelta, group);
    tickSurface();
    tickPhysics(clampedDelta, phase, displayPhase, group);
    markGeosDirty();
    updateMaterials(displayPhase, t, delta);
  });

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    const pushDir = new THREE.Vector3()
      .subVectors(swimPosRef.current, e.point)
      .normalize();
    swimVelRef.current.addScaledVector(pushDir, 4.0);
    hitRef.current = 4.0;
  }, []);

  const handlePointerEnter = useCallback(() => {
    isHoveredRef.current = true;
  }, []);
  const handlePointerLeave = useCallback(() => {
    isHoveredRef.current = false;
  }, []);

  return (
    <group ref={groupRef} scale={0.02}>
      <JellyfishBell
        bulbGeo={bulbGeo}
        faintMatRef={faintMatRef}
        bulbMatRef={bulbMatRef}
        color={color}
        diffuseB={diffuseBProp}
        faintColor={faintColor}
      />
      <JellyfishTail
        tailGeo={tailGeo}
        tailMatRef={tailMatRef}
        color={color}
        faintColor={faintColor}
      />
      <JellyfishHood
        linksGeo={linksGeo}
        hoodMatRef={hoodMatRef}
        color={color}
      />
      <JellyfishTentacles
        tentGeo={tentGeo}
        tentMatRef={tentMatRef}
        faintColor={faintColor}
      />
      <JellyfishMouth
        mouthGeo={mouthGeo}
        mouthMatRef={mouthMatRef}
        color={color}
        faintColor={faintColor}
      />
      {/* Invisible hit sphere (bell center: physics Y=40 → local Y=2 at scale 0.05) */}
      <mesh
        position={[0, 40, 0]}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        visible={false}
      >
        <sphereGeometry args={[45, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  );
}
