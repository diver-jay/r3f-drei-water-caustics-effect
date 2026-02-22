import { useRef, useMemo, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import * as particulate from "particulate";
import "./shaders/GelShaderMaterial";
import "./shaders/BulbShaderMaterial";
import "./shaders/TailShaderMaterial";
import "./shaders/TentacleShaderMaterial";
import "./shaders/LerpShaderMaterial";

const { sin, cos, log, floor, round, PI } = Math;
const PI_HALF = PI * 0.5;
const push = Array.prototype.push;

// ─── Swimming constants ────────────────────────────────────────────────────────
const THRUST_FACTOR = 2.0; // velocity impulse per unit of phase contraction
const GRAVITY = 0.06; // downward drift (units/s)
const TURN_SPEED = 0.7; // angular interpolation speed (rad/s)
const WANDER_MIN = 3.5; // seconds between direction changes (min)
const WANDER_MAX = 7.0; // seconds between direction changes (max)
const BOUNDS_XZ = 3.0; // group center XZ boundary
const BOUNDS_Y_MIN = 0.8; // group center Y minimum
const BOUNDS_Y_MAX = 3.2; // group center Y maximum
const REPEL = 1.2; // boundary repulsion (units/s²)
const SURFACE_Y = 2.0; // group Y where bell top reaches water surface (Y=5)

// ─── GEOM ─────────────────────────────────────────────────────────────────────
function geomPoint(x, y, z, buf) {
  buf.push(x, y, z);
}
function geomCircle(segments, radius, y, buf) {
  const step = (PI * 2) / segments;
  for (let i = 0; i < segments; i++)
    buf.push(cos(step * i) * radius, y, sin(step * i) * radius);
}

// ─── LINKS ────────────────────────────────────────────────────────────────────
function linksLoop(index, count, buf) {
  for (let i = 0; i < count - 1; i++) buf.push(index + i, index + i + 1);
  buf.push(index, index + count - 1);
  return buf;
}
function linksRings(i0, i1, count, buf) {
  for (let i = 0; i < count; i++) buf.push(i0 + i, i1 + i);
  return buf;
}
function linksRadial(center, index, count, buf) {
  for (let i = 0; i < count; i++) buf.push(center, index + i);
  return buf;
}
function linksLine(index, count, buf) {
  for (let i = 0; i < count - 1; i++) buf.push(index + i, index + i + 1);
  return buf;
}

// ─── FACES ────────────────────────────────────────────────────────────────────
function facesRadial(center, index, count, buf) {
  for (let i = 0; i < count - 1; i++)
    buf.push(center, index + i + 1, index + i);
  buf.push(center, index, index + count - 1);
  return buf;
}
function facesQuadDoubleSide(a, b, c, d, buf) {
  buf.push(a, b, c, c, d, a, d, c, b, b, a, d);
  return buf;
}
function facesRings(i0, i1, count, buf) {
  for (let i = 0; i < count - 1; i++) {
    const a = i0 + i,
      b = i0 + i + 1,
      c = i1 + i + 1,
      d = i1 + i;
    buf.push(a, b, c, c, d, a);
  }
  const a = i0 + count - 1,
    b = i0,
    c = i1,
    d = i1 + count - 1;
  buf.push(a, b, c, c, d, a);
  return buf;
}

// ─── Physics helpers ──────────────────────────────────────────────────────────
function ribRadius(t) {
  return sin(PI - PI * 0.55 * t * 1.8) + log(t * 100 + 2) / 3;
}
function tailRibRadius(t) {
  return sin(0.25 * t * PI + 0.5 * PI) * (1 - 0.9 * t);
}
function ribUvs(sv, count, buf) {
  for (let i = 1; i < count; i++) {
    const st = i / count;
    buf.push((st <= 0.5 ? st : 1 - st) * 2, sv);
  }
  buf.push(0, sv);
}
function innerRibIndices(offset, start, segments, buf) {
  const step = floor(segments / 3);
  for (let i = 0; i < 3; i++) {
    buf.push(
      start + ((offset + step * i) % segments),
      start + ((offset + step * (i + 1)) % segments),
    );
  }
  return buf;
}

// ─── buildJellyfish ───────────────────────────────────────────────────────────
function buildJellyfish() {
  const verts = [],
    uvs = [];
  const links = [],
    innerLinks = [];
  const bulbFaces = [],
    tailFaces = [],
    mouthFaces = [];
  const tentLinks = [];
  const tentacles = [];
  const queuedConstraints = [],
    weights = [];
  const ribs = [],
    tailRibs = [];

  const size = 40,
    yOffset = 20;
  const segmentsCount = 4;
  const totalSegments = segmentsCount * 3 * 3;
  const ribsCount = 20;
  const ribRadiusVal = 15;
  const tailRibsCount = 15;
  const tailRibRadiusFactor = 20;
  const tentacleGroupStart = 6;
  const tentacleGroupOffset = 4;
  const tentacleGroupCount = 1;
  const tentacleWeightFactor = 1.25;
  const tailArmSegments = 30,
    tailArmSegmentLength = 1;
  const tailArmWeight = 0.5;
  const tentacleSegments = 40,
    tentacleSegmentLength = 0.7;
  const posTop = yOffset + size;
  const posMid = yOffset;
  const posBottom = yOffset - size;
  const posTail = yOffset - tailArmSegments * tailArmSegmentLength;
  const posTentacle = yOffset - tentacleSegments * tentacleSegmentLength * 1.5;

  const PIN_TOP = 0,
    PIN_MID = 1,
    PIN_BOTTOM = 2,
    PIN_TAIL = 3,
    PIN_TENTACLE = 4;
  const IDX_TOP = 5,
    IDX_MID = 6,
    IDX_BOTTOM = 7;
  const TOP_START = 8;

  const s = {
    verts,
    uvs,
    links,
    innerLinks,
    bulbFaces,
    tailFaces,
    mouthFaces,
    tentLinks,
    tentacles,
    queuedConstraints,
    weights,
    ribs,
    tailRibs,
    size,
    yOffset,
    segmentsCount,
    totalSegments,
    ribsCount,
    ribRadiusVal,
    tailRibsCount,
    tailRibRadiusFactor,
    tentacleGroupStart,
    tentacleGroupOffset,
    tentacleGroupCount,
    tentacleSegments,
    tentacleSegmentLength,
    tentacleWeightFactor,
    tailArmSegments,
    tailArmSegmentLength,
    tailArmWeight,
    posTop,
    posMid,
    posBottom,
    posTail,
    posTentacle,
    PIN_TOP,
    PIN_MID,
    PIN_BOTTOM,
    PIN_TAIL,
    PIN_TENTACLE,
    IDX_TOP,
    IDX_MID,
    IDX_BOTTOM,
    TOP_START,
  };

  createCore(s);
  createBulb(s);
  createTail(s);
  createMouth(s);
  createTentacles(s);
  createSystem(s);
  return s;
}

// ─── createCore ───────────────────────────────────────────────────────────────
function createCore(s) {
  const { verts, uvs, bulbFaces, queuedConstraints } = s;
  const { size, posTop, posMid, posBottom, posTail, posTentacle } = s;
  const {
    PIN_TOP,
    PIN_MID,
    PIN_BOTTOM,
    IDX_TOP,
    IDX_MID,
    IDX_BOTTOM,
    TOP_START,
    totalSegments,
  } = s;

  function q(...args) {
    if (args.length === 1 && Array.isArray(args[0]))
      push.apply(queuedConstraints, args[0]);
    else push.apply(queuedConstraints, args);
  }

  for (const yo of [
    posTop,
    posMid,
    posBottom,
    posTail,
    posTentacle,
    size * 1.5,
    -size * 0.5,
    -size,
  ]) {
    geomPoint(0, yo, 0, verts);
    uvs.push(0, 0);
  }

  q(
    particulate.DistanceConstraint.create([0, size * 0.5], [PIN_TOP, IDX_TOP]),
    particulate.DistanceConstraint.create(
      [size * 0.5, size * 0.7],
      [IDX_TOP, IDX_MID],
    ),
    particulate.DistanceConstraint.create(
      [0, size * 0.5],
      [PIN_BOTTOM, IDX_BOTTOM],
    ),
    particulate.DistanceConstraint.create(
      [size, size * 2],
      [IDX_TOP, IDX_BOTTOM],
    ),
    particulate.AxisConstraint.create(PIN_TOP, PIN_MID, [
      IDX_TOP,
      IDX_MID,
      IDX_BOTTOM,
    ]),
  );
  facesRadial(IDX_TOP, TOP_START, totalSegments, bulbFaces);
}

// ─── updateRibs ───────────────────────────────────────────────────────────────
function updateRibs(ribs, phase, totalSegments) {
  const radiusOffset = 15;
  for (const rib of ribs) {
    const rad = rib.radius + rib.yParam * phase * radiusOffset;
    const radOuter =
      (rib.radiusOuter || rib.radius) + rib.yParam * phase * radiusOffset;
    const radSpine =
      (rib.radiusSpine || rib.radius) + rib.yParam * phase * radiusOffset;
    if (rib.outer) {
      const l = (2 * PI * radOuter) / totalSegments;
      rib.outer.setDistance(l * 0.9, l);
    }
    if (rib.inner) {
      const l = (2 * PI * rad) / 3;
      rib.inner.setDistance(l * 0.8, l);
    }
    if (rib.spine) rib.spine.setDistance(rad * 0.8, radSpine);
  }
}

// ─── createSystem ─────────────────────────────────────────────────────────────
function createSystem(s) {
  const { verts, queuedConstraints, weights } = s;
  const { PIN_TOP, PIN_MID, PIN_BOTTOM, PIN_TAIL, PIN_TENTACLE } = s;
  const { posTop, posMid, posBottom, posTail, posTentacle } = s;

  const system = particulate.ParticleSystem.create(verts, 2);
  for (const c of queuedConstraints) system.addConstraint(c);
  for (let i = 0; i < weights.length; i++)
    if (weights[i] !== undefined) system.setWeight(i, weights[i]);

  system.setWeight(PIN_TOP, 0);
  system.setWeight(PIN_MID, 0);
  system.setWeight(PIN_BOTTOM, 0);
  system.setWeight(PIN_TAIL, 0);

  system.addPinConstraint(
    particulate.PointConstraint.create([0, posTop, 0], PIN_TOP),
  );
  system.addPinConstraint(
    particulate.PointConstraint.create([0, posMid, 0], PIN_MID),
  );
  system.addPinConstraint(
    particulate.PointConstraint.create([0, posBottom, 0], PIN_BOTTOM),
  );
  system.addPinConstraint(
    particulate.PointConstraint.create([0, posTail, 0], PIN_TAIL),
  );
  system.addPinConstraint(
    particulate.PointConstraint.create([0, posTentacle, 0], PIN_TENTACLE),
  );

  const gravityForce = particulate.DirectionalForce.create([0, -2, 0]);
  system.addForce(gravityForce);

  s.system = system;
  s.gravityForce = gravityForce;
}

// ─── createBulb ───────────────────────────────────────────────────────────────
function createBulb(s) {
  for (let i = 0; i < s.ribsCount; i++) {
    createRib(s, i, s.ribsCount);
    if (i > 0) createSkin(s, i - 1, i);
  }
}

function createRib(s, index, total) {
  const { verts, uvs, links, innerLinks, queuedConstraints, ribs } = s;
  const {
    size,
    yOffset,
    totalSegments,
    segmentsCount,
    ribRadiusVal,
    IDX_TOP,
    IDX_BOTTOM,
    TOP_START,
  } = s;

  function q(...args) {
    if (args.length === 1 && Array.isArray(args[0]))
      push.apply(queuedConstraints, args[0]);
    else push.apply(queuedConstraints, args);
  }

  const yParam = index / total;
  const start = index * totalSegments + TOP_START;
  const radius = ribRadius(yParam) * ribRadiusVal;

  geomCircle(totalSegments, radius, size + yOffset - yParam * size, verts);
  ribUvs(yParam, totalSegments, uvs);

  const outerLen = (2 * PI * radius) / totalSegments;
  const outerRib = particulate.DistanceConstraint.create(
    [outerLen * 0.9, outerLen],
    linksLoop(start, totalSegments, []),
  );
  const innerLen = (2 * PI * radius) / 3;
  const indices = [];
  for (let i = 0; i < segmentsCount; i++)
    innerRibIndices(i * 3, start, totalSegments, indices);
  const innerRib = particulate.DistanceConstraint.create(
    [innerLen * 0.8, innerLen],
    indices,
  );

  const isTop = index === 0,
    isBottom = index === total - 1;
  let spine, radiusSpine;
  if (isTop || isBottom) {
    const spineCenter = isTop ? IDX_TOP : IDX_BOTTOM;
    radiusSpine = isTop ? radius * 1.25 : radius;
    spine = particulate.DistanceConstraint.create(
      [radius * 0.5, radiusSpine],
      linksRadial(spineCenter, start, totalSegments, []),
    );
    q(spine);
    push.apply(isTop ? links : innerLinks, spine.indices);
  }

  push.apply(innerLinks, outerRib.indices);
  push.apply(innerLinks, innerRib.indices);
  q(outerRib, innerRib);
  ribs.push({
    start,
    radius,
    radiusSpine,
    yParam,
    yPos: size + yOffset - yParam * size,
    outer: outerRib,
    inner: innerRib,
    spine,
  });
}

function createSkin(s, r0, r1) {
  const { verts, links, bulbFaces, queuedConstraints, ribs, totalSegments } = s;
  function q(...args) {
    if (args.length === 1 && Array.isArray(args[0]))
      push.apply(queuedConstraints, args[0]);
    else push.apply(queuedConstraints, args);
  }
  const rib0 = ribs[r0],
    rib1 = ribs[r1];
  const dist = particulate.Vec3.distance(verts, rib0.start, rib1.start);
  const skin = particulate.DistanceConstraint.create(
    [dist * 0.5, dist],
    linksRings(rib0.start, rib1.start, totalSegments, []),
  );
  q(skin);
  push.apply(links, skin.indices);
  facesRings(rib0.start, rib1.start, totalSegments, bulbFaces);
}

// ─── createTail ───────────────────────────────────────────────────────────────
function createTail(s) {
  for (let i = 0; i < s.tailRibsCount; i++) {
    createTailRib(s, i, s.tailRibsCount);
    createTailSkin(s, i - 1, i);
  }
}

function createTailRib(s, index, total) {
  const { verts, uvs, innerLinks, queuedConstraints, ribs, tailRibs } = s;
  const { size, totalSegments, segmentsCount, tailRibRadiusFactor, IDX_MID } =
    s;

  function q(...args) {
    if (args.length === 1 && Array.isArray(args[0]))
      push.apply(queuedConstraints, args[0]);
    else push.apply(queuedConstraints, args);
  }

  const lastRib = ribs[ribs.length - 1];
  const yParam = index / total;
  const start = verts.length / 3;
  const radiusT = tailRibRadius(yParam);
  const radius = radiusT * lastRib.radius;
  const radiusOuter = radius + yParam * tailRibRadiusFactor;

  geomCircle(totalSegments, radius, lastRib.yPos - yParam * size * 0.8, verts);
  ribUvs(yParam, totalSegments, uvs);

  const mainLen = (2 * PI * radiusOuter) / totalSegments;
  const outerRib = particulate.DistanceConstraint.create(
    [mainLen * 0.9, mainLen * 1.5],
    linksLoop(start, totalSegments, []),
  );
  const innerLen = (2 * PI * radius) / 3;
  const innerIndices = [];
  for (let i = 0; i < segmentsCount; i++)
    innerRibIndices(i * 3, start, totalSegments, innerIndices);
  const innerRib = particulate.DistanceConstraint.create(
    [innerLen * 0.8, innerLen],
    innerIndices,
  );

  let spine;
  if (index === total - 1) {
    spine = particulate.DistanceConstraint.create(
      [radius * 0.8, radius],
      linksRadial(IDX_MID, start, totalSegments, []),
    );
    q(spine);
    push.apply(innerLinks, spine.indices);
  }
  q(outerRib, innerRib);
  tailRibs.push({
    start,
    radius,
    radiusOuter,
    yParam: 1 - yParam,
    yPos: lastRib.yPos - yParam * size * 0.8,
    outer: outerRib,
    inner: innerRib,
    spine,
  });
}

function createTailSkin(s, r0, r1) {
  const {
    verts,
    innerLinks,
    tailFaces,
    queuedConstraints,
    ribs,
    tailRibs,
    totalSegments,
  } = s;
  function q(...args) {
    if (args.length === 1 && Array.isArray(args[0]))
      push.apply(queuedConstraints, args[0]);
    else push.apply(queuedConstraints, args);
  }
  const rib0 = r0 < 0 ? ribs[ribs.length - 1] : tailRibs[r0];
  const rib1 = tailRibs[r1];
  const dist = particulate.Vec3.distance(verts, rib0.start, rib1.start);
  const skin = particulate.DistanceConstraint.create(
    [dist * 0.5, dist],
    linksRings(rib0.start, rib1.start, totalSegments, []),
  );
  q(skin);
  push.apply(innerLinks, skin.indices);
  facesRings(rib0.start, rib1.start, totalSegments, tailFaces);
}

// ─── createTentacles ──────────────────────────────────────────────────────────
function createTentacles(s) {
  for (let i = 0; i < s.tentacleGroupCount; i++)
    createTentacleGroup(s, i, s.tentacleGroupCount);
}

function createTentacleGroup(s, groupIndex, total) {
  const { tentacleGroupStart, tentacleGroupOffset, tentacleSegments, ribs } = s;
  const rib = ribs[tentacleGroupStart + tentacleGroupOffset * groupIndex];
  const count = Math.floor(
    tentacleSegments * (1 - groupIndex / total) * 0.25 +
      tentacleSegments * 0.75,
  );
  for (let i = 0; i < count; i++) {
    createTentacleSegment(s, groupIndex, i, count, rib);
    if (i > 0) linkTentacle(s, groupIndex, i - 1, i);
    else attachTentacles(s, groupIndex, rib);
  }
  attachTentaclesSpine(s, groupIndex);
}

function createTentacleSegment(s, groupIndex, index, total, rib) {
  const {
    verts,
    uvs,
    weights,
    tentacles,
    totalSegments,
    tentacleSegmentLength,
    tentacleWeightFactor,
    yOffset,
  } = s;
  const radius = rib.radius * (0.25 * sin(index * 0.25) + 0.5);
  const start = verts.length / 3;
  geomCircle(
    totalSegments,
    radius,
    -index * tentacleSegmentLength + yOffset,
    verts,
  );
  for (let i = 0; i < totalSegments; i++) uvs.push(0, 0);
  const weight = Math.sqrt(index / total) * tentacleWeightFactor;
  for (let i = start; i < start + totalSegments; i++) weights[i] = weight;
  if (index === 0) s.tentacles.push([]);
  s.tentacles[groupIndex].push({ start });
}

function attachTentacles(s, groupIndex, rib) {
  const {
    tentacles,
    tentLinks,
    queuedConstraints,
    totalSegments,
    tentacleSegmentLength,
  } = s;
  const c = particulate.DistanceConstraint.create(
    [tentacleSegmentLength * 0.5, tentacleSegmentLength],
    linksRings(rib.start, tentacles[groupIndex][0].start, totalSegments, []),
  );
  queuedConstraints.push(c);
  push.apply(tentLinks, c.indices);
}

function linkTentacle(s, groupIndex, i0, i1) {
  const {
    tentacles,
    tentLinks,
    innerLinks,
    queuedConstraints,
    totalSegments,
    tentacleSegmentLength,
  } = s;
  const c = particulate.DistanceConstraint.create(
    [tentacleSegmentLength * 0.5, tentacleSegmentLength],
    linksRings(
      tentacles[groupIndex][i0].start,
      tentacles[groupIndex][i1].start,
      totalSegments,
      [],
    ),
  );
  queuedConstraints.push(c);
  push.apply(tentLinks, c.indices);
  push.apply(innerLinks, c.indices);
}

function attachTentaclesSpine(s, groupIndex) {
  const {
    tentacles,
    queuedConstraints,
    totalSegments,
    PIN_TENTACLE,
    tentacleSegments,
    tentacleSegmentLength,
  } = s;
  const group = tentacles[groupIndex];
  const dist = tentacleSegments * tentacleSegmentLength;
  const spine = particulate.DistanceConstraint.create(
    [dist * 0.5, dist],
    linksRadial(PIN_TENTACLE, group[group.length - 1].start, totalSegments, []),
  );
  queuedConstraints.push(spine);
}

// ─── createMouth ──────────────────────────────────────────────────────────────
function createMouth(s) {
  createMouthArmGroup(s, 1.0, 0, 4, 3);
  createMouthArmGroup(s, 0.8, 1, 8, 3, 3);
  createMouthArmGroup(s, 0.5, 7, 9, 6);
}

function createMouthArmGroup(s, vScale, r0, r1, count, offset) {
  for (let i = 0; i < count; i++)
    createMouthArm(s, vScale, r0, r1, i, count, offset);
}

function ribAt(s, index) {
  const { ribs, tailRibs } = s;
  return (
    tailRibs[tailRibs.length - index - 1] ||
    ribs[ribs.length - index + tailRibs.length - 1]
  );
}

function createMouthArm(s, vScale, r0, r1, index, total, offset) {
  const {
    verts,
    uvs,
    weights,
    mouthFaces,
    links,
    tentLinks,
    innerLinks,
    queuedConstraints,
  } = s;
  const {
    totalSegments,
    tailArmSegments,
    tailArmSegmentLength,
    tailArmWeight,
    posMid,
    PIN_TAIL,
  } = s;

  const tParam = index / total;
  const ribInner = ribAt(s, r0),
    ribOuter = ribAt(s, r1);
  const ribIndex =
    (round(totalSegments * tParam) + (offset || 0)) % totalSegments;
  const innerPin = ribInner.start + ribIndex,
    outerPin = ribOuter.start + ribIndex;
  const scale = particulate.Vec3.distance(verts, innerPin, outerPin);

  const segments = round(vScale * tailArmSegments);
  const innerSize = tailArmSegmentLength,
    outerSize = innerSize * 2.4;
  const bottomPinMax = 20 + (tailArmSegments - segments) * innerSize;
  const innerStart = verts.length / 3;
  const innerEnd = innerStart + segments - 1;
  const outerStart = innerStart + segments;

  const innerIndices = linksLine(innerStart, segments, [innerPin, innerStart]);
  const outerIndices = linksLine(outerStart, segments, [outerPin, outerStart]);

  const linkConstraints = [],
    braceIndices = [],
    linkIndices = [];
  const baseX = cos(PI * 2 * tParam),
    baseZ = sin(PI * 2 * tParam);

  for (let i = 0; i < segments; i++) {
    geomPoint(0, posMid - i * innerSize, 0, verts);
    uvs.push(i / (segments - 1), 0);
  }

  let lastLinkSize = 0;
  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const innerIndex = innerStart + i,
      outerIndex = outerStart + i;
    const linkSize =
      scale *
      (sin(PI_HALF + 10 * t) * 0.25 + 0.75) *
      (sin(PI_HALF + 20 * t) * 0.25 + 0.75) *
      (sin(PI_HALF + 26 * t) * 0.15 + 0.85) *
      sin(PI_HALF + PI * 0.45 * t);
    lastLinkSize = linkSize;
    geomPoint(
      baseX * linkSize,
      posMid - i * innerSize,
      baseZ * linkSize,
      verts,
    );
    uvs.push(t, 1);
    linkConstraints.push(
      particulate.DistanceConstraint.create(
        [linkSize * 0.5, linkSize],
        [innerIndex, outerIndex],
      ),
    );
    if (i > 10) braceIndices.push(innerIndex - 10, outerIndex);
    if (i > 1) linkIndices.push(innerIndex - 1, outerIndex);
    if (i > 1)
      facesQuadDoubleSide(
        innerIndex - 1,
        outerIndex - 1,
        outerIndex,
        innerIndex,
        mouthFaces,
      );
  }

  const inner = particulate.DistanceConstraint.create(
    [innerSize * 0.25, innerSize],
    innerIndices,
  );
  const outer = particulate.DistanceConstraint.create(
    [outerSize * 0.25, outerSize],
    outerIndices,
  );
  const pin = particulate.DistanceConstraint.create(
    [0, bottomPinMax],
    [innerEnd, PIN_TAIL],
  );

  for (const c of linkConstraints) queuedConstraints.push(c);
  queuedConstraints.push(inner, outer, pin);

  if (braceIndices.length > 0) {
    const brace = particulate.DistanceConstraint.create(
      [lastLinkSize * 0.5, 1e8],
      braceIndices,
    );
    queuedConstraints.push(brace);
    push.apply(innerLinks, brace.indices);
  }

  for (let i = innerStart; i < innerStart + segments * 2; i++)
    weights[i] = tailArmWeight;
  push.apply(links, innerIndices);
  push.apply(links, outerIndices);
  push.apply(tentLinks, linkIndices);
  push.apply(tentLinks, braceIndices);
  push.apply(innerLinks, innerIndices);
  push.apply(innerLinks, outerIndices);
  push.apply(innerLinks, linkIndices);
  push.apply(innerLinks, braceIndices);
  push.apply(innerLinks, pin.indices);
}

// ─── Jellyfish Component ──────────────────────────────────────────────────────
export default function Jellyfish({
  color = new THREE.Color(0xff6b6b),
  diffuseB: diffuseBProp = new THREE.Color(0x7a1a1a),
  faintColor = new THREE.Color(0xff4444),
  hoverColor = new THREE.Color(0xffb3b3),
  hoverDiffuseB = new THREE.Color(0xc45050),
  hoverFaintColor = new THREE.Color(0xff8888),
  initialAngle = 0,
  initialPosition = new THREE.Vector3(0, 1.5, 0),
  onSurfaceReach = () => {},
}) {
  const animTimeRef = useRef(Math.random() * 2.5); // PERIOD=2.5, 각 인스턴스 랜덤 위상
  const groupRef = useRef();
  const prevPhaseRef = useRef(0);
  const isHoveredRef = useRef(false);
  const isSurfacingRef = useRef(false);

  // ── 3D swimming state ────────────────────────────────────────────────────────
  const swimPosRef = useRef(initialPosition.clone());
  const swimVelRef = useRef(new THREE.Vector3());
  const wanderAngleRef = useRef(initialAngle);
  // 각 인스턴스마다 다른 초기 pitch (위/옆/아래 다양하게)
  const _initPitch = (Math.random() - 0.5) * PI * 0.8; // ±72°
  const wanderPitchRef = useRef(_initPitch);
  const wanderTargetAngleRef = useRef(
    initialAngle + (Math.random() - 0.5) * 1.2,
  );
  const wanderTargetPitchRef = useRef(_initPitch + (Math.random() - 0.5) * 0.8);
  const wanderTimerRef = useRef(2 + Math.random() * 3);

  // Bell top faces this direction (model +Y → swimDir)
  const swimDirRef = useRef(
    new THREE.Vector3(
      cos(_initPitch) * cos(initialAngle),
      sin(_initPitch),
      cos(_initPitch) * sin(initialAngle),
    ),
  );

  // Reusable objects — no allocation in useFrame
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
  const innerMatRef = useRef();

  // Hover color contrast animation
  const hoverLerpRef = useRef(0);
  // Hit squish: 1.0 on click, decays to 0
  const hitRef = useRef(0);

  // HDR-boosted hover colors — >1.0 values trigger ToneMapping/Bloom for stronger brightness
  const hoverColorHDR = useMemo(
    () =>
      new THREE.Color(
        hoverColor.r * 2.5,
        hoverColor.g * 2.5,
        hoverColor.b * 2.5,
      ),
    [hoverColor],
  );
  const hoverFaintColorHDR = useMemo(
    () =>
      new THREE.Color(
        hoverFaintColor.r * 4.0,
        hoverFaintColor.g * 4.0,
        hoverFaintColor.b * 4.0,
      ),
    [hoverFaintColor],
  );

  const {
    system,
    gravityForce,
    ribs,
    tailRibs,
    links,
    innerLinks,
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
  const innerLinksGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(system.positions, 3));
    g.setAttribute(
      "positionPrev",
      new THREE.BufferAttribute(system.positionsPrev, 3),
    );
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(innerLinks), 1));
    return g;
  }, [system, innerLinks]);

  useFrame((_, delta) => {
    // 탭 전환 후 복귀 시 delta가 수 초짜리로 점프하는 것을 방지
    const clampedDelta = Math.min(delta, 1 / 30) || 0;
    const t = (animTimeRef.current += clampedDelta);
    // 비대칭 펄스: 팽창(0→1) 느리게 75%, 수축(1→0) 빠르게 25%
    const PERIOD = 2.5;
    const EXPAND_RATIO = 0.75;
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

    // Hit squish: 빠르게 decay해 bell 찌그러짐 복원
    hitRef.current *= Math.pow(0.003, clampedDelta);
    const displayPhase = Math.max(0, phase - hitRef.current);

    // ── 펄스 연동 이동 ──────────────────────────────────────────────
    // phase 감소 = bell 수축 = 추진 임펄스 / phase 증가 = bell 확장 = 감속
    const phaseDelta = phase - prevPhaseRef.current;
    prevPhaseRef.current = phase;

    const isContracting = phaseDelta < 0;
    if (isContracting) {
      // 수축 구간: swimDir 방향으로 강한 순간 임펄스
      const impulse = Math.abs(phaseDelta) * THRUST_FACTOR;
      swimVelRef.current.addScaledVector(swimDirRef.current, impulse);
    }

    // ── 비대칭 drag: 수축 중 저항 적음(추진 유지) / 팽창 중 저항 큼(빠른 감속)
    const dragPerSec = isContracting ? 0.85 : 0.4;
    swimVelRef.current.multiplyScalar(Math.pow(dragPerSec, clampedDelta));

    // ── 방향 및 중력/부력 ───────────────────────────────────────────
    if (!isSurfacingRef.current) {
      // 자연 하강 (부력으로 상쇄, 미세 중력)
      swimVelRef.current.y -= GRAVITY * clampedDelta;

      // Wandering: 랜덤 방향 변경
      wanderTimerRef.current -= clampedDelta;
      if (wanderTimerRef.current <= 0) {
        // 누적 방지: 새 목표 설정 전 현재값 정규화 (음수 포함 올바른 모듈로)
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

      // 현재 방향을 목표 방향으로 부드럽게 보간 (최단 경로)
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
      // 수면 상승: 수직으로 방향 전환 후 강한 상승
      swimDirRef.current.set(0, 1, 0);
      swimVelRef.current.y += 3.0 * clampedDelta;
    }

    // ── 경계 반발력 ─────────────────────────────────────────────────
    const pos = swimPosRef.current;
    const vel = swimVelRef.current;

    if (pos.x > BOUNDS_XZ) vel.x -= REPEL * clampedDelta;
    if (pos.x < -BOUNDS_XZ) vel.x += REPEL * clampedDelta;
    if (pos.z > BOUNDS_XZ) vel.z -= REPEL * clampedDelta;
    if (pos.z < -BOUNDS_XZ) vel.z += REPEL * clampedDelta;
    if (pos.y < BOUNDS_Y_MIN) vel.y += REPEL * clampedDelta;
    if (pos.y > BOUNDS_Y_MAX) vel.y -= REPEL * clampedDelta;

    // 위치 업데이트 + 하드 클램프
    pos.addScaledVector(vel, clampedDelta);
    pos.x = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.x));
    pos.z = Math.max(-BOUNDS_XZ - 0.5, Math.min(BOUNDS_XZ + 0.5, pos.z));
    pos.y = Math.max(BOUNDS_Y_MIN - 0.2, Math.min(BOUNDS_Y_MAX + 0.5, pos.y));

    // ── Group transform: 위치 + 방향 ───────────────────────────────
    const group = groupRef.current;
    if (!group) return;

    group.position.copy(pos);

    // Bell top (model +Y) → swimDir 방향으로 회전 (Roll 비틀림 방지 기저 벡터 계산)
    const dirX = swimDirRef.current.x;
    const dirZ = swimDirRef.current.z;
    const len = Math.sqrt(dirX * dirX + dirZ * dirZ);

    if (len > 0.0001) {
      // 수평 Right 벡터 도출 (Up x swimDir)
      _rightVecRef.current.set(dirZ / len, 0, -dirX / len);
    }
    // Right(X)축과 swimDir(Y축)의 외적으로 Forward(Z)축 계산
    _forwardVecRef.current
      .crossVectors(_rightVecRef.current, swimDirRef.current)
      .normalize();

    // 3개의 직교 축을 기반으로 매트릭스를 만들고 쿼터니언으로 변환
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

    // ── 수면 도달 감지 ──────────────────────────────────────────────
    if (isSurfacingRef.current && pos.y >= SURFACE_Y) {
      const worldPos = new THREE.Vector3(pos.x, 5, pos.z);
      onSurfaceReach(worldPos);
      isSurfacingRef.current = false;
      // 원래 수영 위치로 복귀
      pos.set(pos.x, initialPosition.y, pos.z);
      vel.set(0, 0, 0);
      wanderAngleRef.current = initialAngle;
      wanderPitchRef.current = 0;
      swimDirRef.current.set(cos(initialAngle), 0, sin(initialAngle));
    }

    // ── Physics ─────────────────────────────────────────────────────
    gravityForce.set(0, -2 - phase * 3 - Math.max(0, vel.y) * 1.5, 0);
    updateRibs(ribs, displayPhase, totalSegments);
    updateRibs(tailRibs, displayPhase, totalSegments);

    // ── 촉수 드래그: tick을 분리해 accumulatedForces에 직접 주입 ─────
    // world-space vel을 model-space로 변환해야 올바른 방향으로 drag가 적용됨
    _invQuatRef.current.copy(group.quaternion).invert();
    _velModelRef.current.copy(vel).applyQuaternion(_invQuatRef.current);
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

    // ── Verlet velocity damping ──────────────────────────────────────
    {
      const keepFraction = Math.pow(0.82, clampedDelta);
      const p = system.positions;
      const pp = system.positionsPrev;
      for (let i = 0, n = p.length; i < n; i++) {
        pp[i] += (p[i] - pp[i]) * (1 - keepFraction);
      }
    }

    // ── Geometry 버퍼 갱신 ──────────────────────────────────────────
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
    innerLinksGeo.attributes.position.needsUpdate = true;
    innerLinksGeo.attributes.positionPrev.needsUpdate = true;

    // ── Shader uniforms ──────────────────────────────────────────────
    if (bulbMatRef.current) {
      bulbMatRef.current.stepProgress = displayPhase;
      bulbMatRef.current.time = t;
    }
    if (faintMatRef.current) {
      faintMatRef.current.stepProgress = displayPhase;
      // Bioluminescence: hover 시 opacity 부드럽게 증가
      const targetOpacity = isHoveredRef.current ? 0.7 : 0.05;
      faintMatRef.current.opacity +=
        (targetOpacity - faintMatRef.current.opacity) * 5 * delta;
    }
    if (tailMatRef.current) tailMatRef.current.stepProgress = displayPhase;
    if (hoodMatRef.current) hoodMatRef.current.stepProgress = displayPhase;
    if (tentMatRef.current) tentMatRef.current.stepProgress = displayPhase;
    if (mouthMatRef.current) mouthMatRef.current.stepProgress = displayPhase;
    if (innerMatRef.current) innerMatRef.current.stepProgress = displayPhase;

    // Hover: 모든 색상을 hover 색상으로 부드럽게 전환
    const targetLerp = isHoveredRef.current ? 1 : 0;
    hoverLerpRef.current += (targetLerp - hoverLerpRef.current) * 5 * delta;
    const h = hoverLerpRef.current;
    if (bulbMatRef.current) {
      bulbMatRef.current.diffuse.lerpColors(color, hoverColorHDR, h);
      bulbMatRef.current.diffuseB.lerpColors(diffuseBProp, hoverDiffuseB, h);
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
    if (innerMatRef.current) {
      innerMatRef.current.diffuse.lerpColors(color, hoverColorHDR, h);
    }
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
      {/* Bioluminescent rim glow — hover 시 발광 강화 */}
      <mesh geometry={bulbGeo} scale={1.05}>
        <gelShaderMaterial
          ref={faintMatRef}
          diffuse={faintColor}
          opacity={0.05}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bell (주 갓) */}
      <mesh geometry={bulbGeo} scale={0.95}>
        <bulbShaderMaterial
          ref={bulbMatRef}
          diffuse={color}
          diffuseB={diffuseBProp}
          opacity={0.75}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Sub-umbrella (꼬리 깔때기) */}
      <mesh geometry={tailGeo} scale={0.95}>
        <tailShaderMaterial
          ref={tailMatRef}
          diffuse={faintColor}
          diffuseB={color}
          scale={3}
          opacity={0.55}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hood contour wireframe */}
      <lineSegments geometry={linksGeo}>
        <tentacleShaderMaterial
          ref={hoodMatRef}
          diffuse={color}
          opacity={0.35}
          transparent
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>

      {/* Tentacles */}
      <lineSegments geometry={tentGeo}>
        <tentacleShaderMaterial
          ref={tentMatRef}
          diffuse={faintColor}
          area={2000}
          opacity={0.25}
          transparent
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>

      {/* Mouth arms */}
      <mesh geometry={mouthGeo}>
        <tailShaderMaterial
          ref={mouthMatRef}
          diffuse={faintColor}
          diffuseB={color}
          scale={3}
          opacity={0.75 * 0.65}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

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
