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

const _WHITE = new THREE.Color(1, 1, 1);
const _WHITE_BRIGHT = new THREE.Color(2.5, 2.5, 2.5);
const _targetQuat = new THREE.Quaternion();
const _invQuat = new THREE.Quaternion();
const _velModel = new THREE.Vector3();
const _forwardVec = new THREE.Vector3();
const _matrix = new THREE.Matrix4();
const _chargeBase = new THREE.Color();
const _chargeHover = new THREE.Color();
const _chargeDark = new THREE.Color();
const _chargeHoverDark = new THREE.Color();

const GRAVITY = 0.06;
const TURN_SPEED = 0.7;
const WANDER_MIN = 3.5;
const WANDER_MAX = 7.0;
const BOUNDS_XZ = 3.0;
const BOUNDS_Y_MIN = 0.8;
const BOUNDS_Y_MAX = 3.2;
const REPEL = 1.2;
const SURFACE_Y = 2.0;

export default function Jellyfish({
  colors: {
    base: baseColor = new THREE.Color(0xff6b6b),
    dark: darkColor = new THREE.Color(0x7a1a1a),
    glow: glowColor = new THREE.Color(0xff4444),
  } = {},
  initial: {
    azimuth: initialAngle = 0,
    position: initialPosition = new THREE.Vector3(0, 1.5, 0),
  } = {},
  speed = 2.0,
  size = 0.7,
  onPositionUpdate = null,
  onSurfaceReach = () => {},
  connectionGlowRef = null,
  chargeRef = null,
}) {
  // ① Three.js object
  const group = useRef();

  // ② Materials
  const bulbMaterial = useRef();
  const faintMaterial = useRef();
  const tailMaterial = useRef();
  const hoodMaterial = useRef();
  const tentacleMaterial = useRef();
  const mouthMaterial = useRef();

  // ③ Pulse animation
  const animTime = useRef(Math.random() * 2.5);
  const prevPhase = useRef(0);
  const hit = useRef(0);
  const hoverLerp = useRef(0);

  // ④ Boolean state
  const isHovered = useRef(false);
  const isSurfacing = useRef(false);

  // ⑤ Swimming physics
  const swimPosition = useRef(initialPosition.clone());
  const swimVelocity = useRef(new THREE.Vector3());

  // ⑥ Wander
  const wanderAngle = useRef(initialAngle);
  const _initPitch = (Math.random() - 0.5) * PI * 0.8;
  const wanderPitch = useRef(_initPitch);
  const wanderTargetAngle = useRef(initialAngle + (Math.random() - 0.5) * 1.2);
  const wanderTargetPitch = useRef(_initPitch + (Math.random() - 0.5) * 0.8);
  const wanderTimer = useRef(2 + Math.random() * 3);
  const swimDirection = useRef(
    new THREE.Vector3(
      cos(_initPitch) * cos(initialAngle),
      sin(_initPitch),
      cos(_initPitch) * sin(initialAngle),
    ),
  );

  // ⑦ Per-instance scratch (carries stable right vector when moving vertically)
  const _rightVector = useRef(new THREE.Vector3(1, 0, 0));

  const hoverBaseColor = useMemo(
    () =>
      new THREE.Color(baseColor.r * 2.5, baseColor.g * 2.5, baseColor.b * 2.5),
    [baseColor],
  );
  const hoverGlowColor = useMemo(
    () =>
      new THREE.Color(glowColor.r * 4.0, glowColor.g * 4.0, glowColor.b * 4.0),
    [glowColor],
  );
  const hoverDarkColor = useMemo(
    () =>
      new THREE.Color().lerpColors(darkColor, new THREE.Color(1, 1, 1), 0.3),
    [darkColor],
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

  const makeMeshGeometry = (faces) => {
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
  };

  const makeLineGeometry = (indices) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(system.positions, 3),
    );
    geo.setAttribute(
      "positionPrev",
      new THREE.BufferAttribute(system.positionsPrev, 3),
    );
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(indices), 1));
    return geo;
  };

  const bulbGeometry = useMemo(() => {
    const g = makeMeshGeometry(bulbFaces);
    g.computeVertexNormals();
    return g;
  }, [system, bulbFaces, uvs]);
  const tailGeometry = useMemo(
    () => makeMeshGeometry(tailFaces),
    [system, tailFaces, uvs],
  );
  const mouthGeometry = useMemo(
    () => makeMeshGeometry(mouthFaces),
    [system, mouthFaces, uvs],
  );

  const linksGeometry = useMemo(() => makeLineGeometry(links), [system, links]);
  const tentacleGeometry = useMemo(
    () => makeLineGeometry(tentLinks),
    [system, tentLinks],
  );

  const tickPulse = (dt) => {
    const PERIOD = 2.5,
      EXPAND_RATIO = 0.75;
    const t = (animTime.current += dt);
    const cycleT = (t % PERIOD) / PERIOD;
    let phase;
    if (cycleT < EXPAND_RATIO) {
      phase = (sin((cycleT / EXPAND_RATIO) * PI - PI * 0.5) + 1) * 0.5;
    } else {
      phase =
        1 -
        (sin(((cycleT - EXPAND_RATIO) / (1 - EXPAND_RATIO)) * PI - PI * 0.5) +
          1) *
          0.5;
    }
    hit.current *= Math.pow(0.003, dt);
    const displayPhase = Math.max(0, phase - hit.current);
    return { t, phase, displayPhase };
  };

  const tickWander = (dt) => {
    swimVelocity.current.y -= GRAVITY * dt;

    wanderTimer.current -= dt;
    if (wanderTimer.current <= 0) {
      wanderAngle.current =
        ((wanderAngle.current % (PI * 2)) + PI * 2) % (PI * 2);
      wanderPitch.current = Math.max(
        -PI * 0.45,
        Math.min(PI * 0.45, wanderPitch.current),
      );
      wanderTargetAngle.current =
        wanderAngle.current + (Math.random() - 0.5) * PI * 1.2;
      wanderTargetPitch.current = Math.max(
        -PI * 0.45,
        Math.min(
          PI * 0.45,
          wanderPitch.current + (Math.random() - 0.5) * PI * 0.7,
        ),
      );
      wanderTimer.current =
        WANDER_MIN + Math.random() * (WANDER_MAX - WANDER_MIN);
    }

    const rawAngleDiff = wanderTargetAngle.current - wanderAngle.current;
    const shortAngleDiff =
      rawAngleDiff - Math.round(rawAngleDiff / (PI * 2)) * (PI * 2);
    wanderAngle.current += shortAngleDiff * TURN_SPEED * dt;
    wanderPitch.current +=
      (wanderTargetPitch.current - wanderPitch.current) *
      TURN_SPEED *
      dt;

    const a = wanderAngle.current,
      p = wanderPitch.current;
    const cp = cos(p);
    swimDirection.current.set(cp * cos(a), sin(p), cp * sin(a)).normalize();
  };

  const tickBounds = (dt) => {
    const pos = swimPosition.current;
    const vel = swimVelocity.current;
    if (pos.x > BOUNDS_XZ) vel.x -= REPEL * dt;
    if (pos.x < -BOUNDS_XZ) vel.x += REPEL * dt;
    if (pos.z > BOUNDS_XZ) vel.z -= REPEL * dt;
    if (pos.z < -BOUNDS_XZ) vel.z += REPEL * dt;
    if (pos.y < BOUNDS_Y_MIN) vel.y += REPEL * dt;
    if (pos.y > BOUNDS_Y_MAX) vel.y -= REPEL * dt;
    pos.addScaledVector(vel, dt);
    pos.x = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.x));
    pos.z = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.z));
    pos.y = Math.max(BOUNDS_Y_MIN - 0.2, Math.min(BOUNDS_Y_MAX + 0.5, pos.y));
  };

  const tickSwim = (dt, phase) => {
    const phaseDelta = phase - prevPhase.current;
    prevPhase.current = phase;

    const isContracting = phaseDelta < 0;
    if (isContracting) {
      swimVelocity.current.addScaledVector(
        swimDirection.current,
        Math.abs(phaseDelta) * speed,
      );
    }
    swimVelocity.current.multiplyScalar(
      Math.pow(isContracting ? 0.85 : 0.4, dt),
    );

    if (!isSurfacing.current) {
      tickWander(dt);
    } else {
      swimDirection.current.set(0, 1, 0);
      swimVelocity.current.y += 3.0 * dt;
    }

    tickBounds(dt);
  };

  const tickGroupTransform = (dt, threeGroup) => {
    threeGroup.position.copy(swimPosition.current);

    const dirX = swimDirection.current.x;
    const dirZ = swimDirection.current.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);
    if (len > 0.0001) {
      _rightVector.current.set(dirZ / len, 0, -dirX / len);
    }
    _forwardVec
      .crossVectors(_rightVector.current, swimDirection.current)
      .normalize();
    _matrix.makeBasis(_rightVector.current, swimDirection.current, _forwardVec);
    _targetQuat.setFromRotationMatrix(_matrix);
    threeGroup.quaternion.slerp(_targetQuat, 1 - Math.exp(-1.5 * dt));
  };

  const tickSurface = () => {
    const pos = swimPosition.current;
    const vel = swimVelocity.current;
    if (isSurfacing.current && pos.y >= SURFACE_Y) {
      onSurfaceReach(new THREE.Vector3(pos.x, 5, pos.z));
      isSurfacing.current = false;
      pos.set(pos.x, initialPosition.y, pos.z);
      vel.set(0, 0, 0);
      wanderAngle.current = initialAngle;
      wanderPitch.current = 0;
      swimDirection.current.set(cos(initialAngle), 0, sin(initialAngle));
    }
  };

  const tickPhysics = (dt, phase, displayPhase, threeGroup) => {
    gravityForce.set(
      0,
      -2 - phase * 3 - Math.max(0, swimVelocity.current.y) * 1.5,
      0,
    );
    updateRibs(ribs, displayPhase, totalSegments);
    updateRibs(tailRibs, displayPhase, totalSegments);

    _invQuat.copy(threeGroup.quaternion).invert();
    _velModel.copy(swimVelocity.current).applyQuaternion(_invQuat);
    const vmx = _velModel.x;
    const vmy = _velModel.y;
    const vmz = _velModel.z;

    const tentStart = tentacles[0][0].start;
    const tentEnd = tentacles[0][tentacles[0].length - 1].start + totalSegments;
    system.accumulateForces(dt);
    const af = system.accumulatedForces;
    const DRAG = 15.0;
    for (let i = tentStart; i < tentEnd; i++) {
      const ix = i * 3;
      af[ix] -= vmx * DRAG;
      af[ix + 1] -= vmy * DRAG;
      af[ix + 2] -= vmz * DRAG;
    }
    system.integrate(dt);
    system.satisfyConstraints();

    const keepFraction = Math.pow(0.82, dt);
    const p = system.positions;
    const pp = system.positionsPrev;
    for (let i = 0, n = p.length; i < n; i++) {
      pp[i] += (p[i] - pp[i]) * (1 - keepFraction);
    }
  };

  const markGeosDirty = () => {
    bulbGeometry.attributes.position.needsUpdate = true;
    bulbGeometry.attributes.positionPrev.needsUpdate = true;
    bulbGeometry.computeVertexNormals();
    tailGeometry.attributes.position.needsUpdate = true;
    tailGeometry.attributes.positionPrev.needsUpdate = true;
    linksGeometry.attributes.position.needsUpdate = true;
    linksGeometry.attributes.positionPrev.needsUpdate = true;
    tentacleGeometry.attributes.position.needsUpdate = true;
    tentacleGeometry.attributes.positionPrev.needsUpdate = true;
    mouthGeometry.attributes.position.needsUpdate = true;
    mouthGeometry.attributes.positionPrev.needsUpdate = true;
  };

  const updateMaterials = (displayPhase, t, delta) => {
    if (bulbMaterial.current) {
      bulbMaterial.current.stepProgress = displayPhase;
      bulbMaterial.current.time = t;
    }
    if (faintMaterial.current) {
      faintMaterial.current.stepProgress = displayPhase;
      const targetOpacity = isHovered.current ? 0.7 : 0.05;
      faintMaterial.current.opacity +=
        (targetOpacity - faintMaterial.current.opacity) * 5 * delta;
    }
    if (tailMaterial.current) tailMaterial.current.stepProgress = displayPhase;
    if (hoodMaterial.current) hoodMaterial.current.stepProgress = displayPhase;
    if (tentacleMaterial.current)
      tentacleMaterial.current.stepProgress = displayPhase;
    if (mouthMaterial.current)
      mouthMaterial.current.stepProgress = displayPhase;

    const targetLerp = isHovered.current ? 1 : 0;
    hoverLerp.current += (targetLerp - hoverLerp.current) * 5 * delta;
    const h = Math.max(
      hoverLerp.current,
      connectionGlowRef ? connectionGlowRef.value : 0,
    );

    if (bulbMaterial.current) {
      if (chargeRef) {
        const c = chargeRef.value;
        _chargeBase.lerpColors(_WHITE, baseColor, c);
        _chargeHover.lerpColors(_WHITE_BRIGHT, hoverBaseColor, c);
        _chargeDark.lerpColors(_WHITE, darkColor, c);
        _chargeHoverDark.lerpColors(_WHITE, hoverDarkColor, c);
        bulbMaterial.current.diffuse.lerpColors(_chargeBase, _chargeHover, h);
        bulbMaterial.current.diffuseB.lerpColors(
          _chargeDark,
          _chargeHoverDark,
          h,
        );
      } else {
        bulbMaterial.current.diffuse.lerpColors(baseColor, hoverBaseColor, h);
        bulbMaterial.current.diffuseB.lerpColors(darkColor, hoverDarkColor, h);
      }
      bulbMaterial.current.opacity = 0.75 + h * 0.2;
    }
    if (tailMaterial.current) {
      tailMaterial.current.diffuse.lerpColors(glowColor, hoverGlowColor, h);
      tailMaterial.current.diffuseB.lerpColors(baseColor, hoverBaseColor, h);
      tailMaterial.current.opacity = 0.55 + h * 0.2;
    }
    if (hoodMaterial.current) {
      hoodMaterial.current.diffuse.lerpColors(baseColor, hoverBaseColor, h);
      hoodMaterial.current.opacity = 0.35 + h * 0.55;
    }
    if (tentacleMaterial.current) {
      tentacleMaterial.current.diffuse.lerpColors(glowColor, hoverGlowColor, h);
    }
    if (mouthMaterial.current) {
      mouthMaterial.current.diffuse.lerpColors(glowColor, hoverGlowColor, h);
      mouthMaterial.current.diffuseB.lerpColors(baseColor, hoverBaseColor, h);
    }
  };

  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      const pushDir = new THREE.Vector3()
        .subVectors(swimPosition.current, e.point)
        .normalize();
      swimVelocity.current.addScaledVector(pushDir, 4.0);
      hit.current = 4.0;
      if (chargeRef) {
        chargeRef.value = Math.min(1, chargeRef.value + 0.1);
      }
    },
    [chargeRef],
  );

  const handlePointerEnter = useCallback(() => {
    isHovered.current = true;
  }, []);

  const handlePointerLeave = useCallback(() => {
    isHovered.current = false;
  }, []);

  useFrame((_, delta) => {
    if (!group.current) return;
    const dt = Math.min(delta, 1 / 30) || 0;

    const { t, phase, displayPhase } = tickPulse(dt);
    tickSwim(dt, phase);
    tickGroupTransform(dt, group.current);
    tickSurface();
    tickPhysics(dt, phase, displayPhase, group.current);

    onPositionUpdate?.(swimPosition.current);
    markGeosDirty();
    updateMaterials(displayPhase, t, delta);
  });

  return (
    <group ref={group} scale={0.02 * size}>
      <JellyfishBell
        bulbGeo={bulbGeometry}
        faintMatRef={faintMaterial}
        bulbMatRef={bulbMaterial}
        color={baseColor}
        diffuseB={darkColor}
        faintColor={glowColor}
      />
      <JellyfishTail
        tailGeo={tailGeometry}
        tailMatRef={tailMaterial}
        color={baseColor}
        faintColor={glowColor}
      />
      <JellyfishHood
        linksGeo={linksGeometry}
        hoodMatRef={hoodMaterial}
        color={baseColor}
      />
      <JellyfishTentacles
        tentGeo={tentacleGeometry}
        tentMatRef={tentacleMaterial}
        faintColor={glowColor}
      />
      <JellyfishMouth
        mouthGeo={mouthGeometry}
        mouthMatRef={mouthMaterial}
        color={baseColor}
        faintColor={glowColor}
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
