import * as particulate from "particulate";

const { sin, cos, log, floor, round, PI } = Math;
const PI_HALF = PI * 0.5;
const push = Array.prototype.push;

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
export default function buildJellyfish() {
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
export function updateRibs(ribs, phase, totalSegments) {
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
    (Math.round(totalSegments * tParam) + (offset || 0)) % totalSegments;
  const innerPin = ribInner.start + ribIndex,
    outerPin = ribOuter.start + ribIndex;
  const scale = particulate.Vec3.distance(verts, innerPin, outerPin);

  const segments = Math.round(vScale * tailArmSegments);
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
