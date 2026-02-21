// Shared vertex shader
export const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Drop shader - adds ripples to the water surface
export const dropFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec2 center;
  uniform float radius;
  uniform float strength;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(waterTexture, vUv);
    float drop = max(0.0, 1.0 - length(center * 0.5 + 0.5 - vUv) / radius);
    drop = 0.5 - cos(drop * 3.14159) * 0.5;

    float dampingFactor = 1.5;
    info.r += drop * strength * dampingFactor;

    gl_FragColor = info;
  }
`;

// Update shader - propagates waves using spring-damper system
export const updateFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec2 delta;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(waterTexture, vUv);

    vec2 dx = vec2(delta.x, 0.0);
    vec2 dy = vec2(0.0, delta.y);

    float average = (
      texture2D(waterTexture, vUv - dx).r +
      texture2D(waterTexture, vUv - dy).r +
      texture2D(waterTexture, vUv + dx).r +
      texture2D(waterTexture, vUv + dy).r
    ) * 0.25;

    float restingHeight = 0.4;
    float springForce = (restingHeight - info.r) * 0.006;

    info.g += (average - info.r) * 2.0;
    info.g *= 0.985;
    info.g += springForce;
    info.r += info.g;

    gl_FragColor = info;
  }
`;

// Normal shader - calculates normals from height map
export const normalFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec2 delta;
  varying vec2 vUv;

  void main() {
    vec4 info = texture2D(waterTexture, vUv);

    vec2 dx = vec2(delta.x, 0.0);
    vec2 dy = vec2(0.0, delta.y);

    float h0 = texture2D(waterTexture, vUv - dx - dy).r;
    float h1 = texture2D(waterTexture, vUv - dy).r;
    float h2 = texture2D(waterTexture, vUv + dx - dy).r;
    float h3 = texture2D(waterTexture, vUv - dx).r;
    float h4 = texture2D(waterTexture, vUv).r;
    float h5 = texture2D(waterTexture, vUv + dx).r;
    float h6 = texture2D(waterTexture, vUv - dx + dy).r;
    float h7 = texture2D(waterTexture, vUv + dy).r;
    float h8 = texture2D(waterTexture, vUv + dx + dy).r;

    float amplitudeScale = 1.5;
    float gx = (h2 + 2.0 * h5 + h8 - (h0 + 2.0 * h3 + h6)) * amplitudeScale;
    float gy = (h6 + 2.0 * h7 + h8 - (h0 + 2.0 * h1 + h2)) * amplitudeScale;

    info.b = gx;
    info.a = gy;

    gl_FragColor = info;
  }
`;

// Projected caustics vertex shader - passes world position to fragment
export const projectedCausticsVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Projected caustics fragment shader - for arbitrary meshes with base color
export const projectedCausticsFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec3 waterPosition;
  uniform float waterSize;
  uniform float chromaticAberration;
  uniform float time;
  uniform vec3 baseColor;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    // Project world XZ to water UV space
    vec2 waterUV = (vWorldPosition.xz - waterPosition.xz) / waterSize + 0.5;

    // Subtle time-based distortion
    vec2 distortedUv = waterUV + vec2(
      sin(waterUV.y * 15.0 + time * 0.5) * 0.002,
      cos(waterUV.x * 15.0 + time * 0.5) * 0.002
    );

    // Sample water simulation
    vec4 waterData = texture2D(waterTexture, distortedUv);
    float gx = waterData.b;
    float gy = waterData.a;

    // Caustic intensity from gradient magnitude
    float gradient = length(vec2(gx, gy));
    float caustic = smoothstep(0.0, 0.3, gradient);
    caustic = pow(caustic, 0.5);

    // Chromatic aberration
    float caR = texture2D(waterTexture, distortedUv + vec2(chromaticAberration, 0.0)).b;
    float caB = texture2D(waterTexture, distortedUv - vec2(chromaticAberration, 0.0)).b;
    vec3 aberration = vec3(
      smoothstep(0.0, 0.4, abs(caR)) * 0.15,
      0.0,
      smoothstep(0.0, 0.4, abs(caB)) * 0.15
    );

    // Combine base color with caustic light
    vec3 causticLight = vec3(0.8, 0.9, 1.0) * caustic * 0.6 + aberration;
    vec3 finalColor = baseColor + causticLight + vec3(caustic * 0.3);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Water surface vertex shader for CustomShaderMaterial (CSM)
// Displaces vertices using water simulation height and computes normals from neighbor samples
export const waterSurfaceVertexShader = `
  uniform sampler2D waterTexture;
  uniform vec3 waterPosition;
  uniform float waterSize;
  uniform float heightScale;

  void main() {
    // Compute world position for water UV projection
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vec2 waterUV = (worldPos.xz - waterPosition.xz) / waterSize + 0.5;

    // Sample center height
    float height = texture2D(waterTexture, waterUV).r;
    float restHeight = 0.4;

    // Displace vertex along local Z (becomes world Y after -90deg X rotation)
    csm_Position.z += (height - restHeight) * heightScale;

    // Sample neighbor heights for normal calculation
    float texel = 1.0 / 256.0;
    float hL = texture2D(waterTexture, waterUV + vec2(-texel, 0.0)).r;
    float hR = texture2D(waterTexture, waterUV + vec2( texel, 0.0)).r;
    float hD = texture2D(waterTexture, waterUV + vec2(0.0, -texel)).r;
    float hU = texture2D(waterTexture, waterUV + vec2(0.0,  texel)).r;

    // Finite difference normal in local space (plane XY, displacement along Z)
    float normalScale = heightScale / (2.0 * texel * waterSize);
    csm_Normal = normalize(vec3(
      -(hR - hL) * normalScale,
      -(hU - hD) * normalScale,
      1.0
    ));
  }
`;

// Pool caustics vertex shader - passes world position and world normal
export const poolCausticsVertexShader = `
  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// Pool caustics fragment shader - box with top face discarded, camera-facing wall fade
export const poolCausticsFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec3 waterPosition;
  uniform float waterSize;
  uniform float chromaticAberration;
  uniform float time;
  uniform float waterSurfaceY;
  uniform vec3 depthColor;
  uniform vec3 lightDir;

  uniform sampler2D tileColor;
  uniform sampler2D tileNormal;
  uniform sampler2D tileRoughness;
  uniform vec2 tileRepeat;
  uniform float wallHeight;

  varying vec2 vUv;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;

  void main() {
    vec3 normal = normalize(vWorldNormal);

    // Discard top face
    if (normal.y > 0.5) discard;

    // Discard camera-facing wall faces
    if (abs(normal.y) < 0.5) {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      float facing = dot(viewDir, normal);
      if (facing > 0.0) discard;
    }

    // Tile UVs with repeat
    vec2 tileUv = vUv * tileRepeat;
    float roughness = texture2D(tileRoughness, tileUv).r;

    // Refracted light direction through water surface (IOR_WATER = 1.333)
    // lightDir: FROM scene TOWARD light (positive Y = above)
    // Reference: madebyevan.com/webgl-water renderer.js
    //   refractedLight = -refract(-light, vec3(0,1,0), IOR_AIR/IOR_WATER)
    // Result points upward (from underwater fragment back toward water surface)
    vec3 refractedDir = -refract(-lightDir, vec3(0.0, 1.0, 0.0), 1.0 / 1.333);

    // Diffuse lighting using the INTERIOR-facing normal.
    // Box geometry normals point OUTWARD, but we render the pool interior,
    // so the face that receives light faces INWARD = -normal.
    // e.g. floor outward normal = (0,-1,0), interior = (0,+1,0) → gets light from above.
    float diffuse = max(0.0, dot(refractedDir, -normal));

    // Sample water directly above this fragment (direct XZ projection).
    // The reference projects along the refracted light ray, but that formula is designed
    // for a pre-computed ray-traced caustic texture and overshoots the UV bounds on our
    // larger pool, leaving edges/corners with no caustic.
    // Directionality is already handled by the diffuse term above.
    vec2 waterUV = (vWorldPosition.xz - waterPosition.xz) / waterSize + 0.5;

    // Subtle time-based distortion
    vec2 distortedUv = waterUV + vec2(
      sin(waterUV.y * 15.0 + time * 0.5) * 0.002,
      cos(waterUV.x * 15.0 + time * 0.5) * 0.002
    );

    // Sample water simulation
    vec4 waterData = texture2D(waterTexture, distortedUv);
    float gx = waterData.b;
    float gy = waterData.a;

    // Caustic intensity from gradient magnitude
    float gradient = length(vec2(gx, gy));
    float caustic = smoothstep(0.0, 0.3, gradient);
    caustic = pow(caustic, 0.5);
    caustic *= (1.0 - roughness * 0.5);

    // Height-based attenuation for walls (stronger at bottom, weaker near surface)
    if (abs(normal.y) < 0.5) {
      float bottomY = waterPosition.y;
      float topY = waterPosition.y + wallHeight;
      float heightFactor = 1.0 - smoothstep(bottomY, topY, vWorldPosition.y);
      caustic *= mix(0.3, 1.0, heightFactor);
    }

    // Chromatic aberration
    float caR = texture2D(waterTexture, distortedUv + vec2(chromaticAberration, 0.0)).b;
    float caB = texture2D(waterTexture, distortedUv - vec2(chromaticAberration, 0.0)).b;
    vec3 aberration = vec3(
      smoothstep(0.0, 0.4, abs(caR)) * 0.15,
      0.0,
      smoothstep(0.0, 0.4, abs(caB)) * 0.15
    );

    // Tile color with refraction distortion
    vec2 refractionOffset = vec2(gx, gy) * 0.02;
    vec3 tileCol = texture2D(tileColor, tileUv + refractionOffset).rgb;

    vec3 finalColor;
    // Above-water: standard tile with caustic tint
    vec3 causticLightAbove = vec3(0.8, 0.9, 1.0) * caustic * 0.6 + aberration;
    vec3 aboveColor = tileCol + causticLightAbove + vec3(caustic * 0.3);

    // Underwater: dark ambient + white caustic highlight
    vec3 underwaterAmbient = tileCol * 0.5 * depthColor * 1.2;
    vec3 causticHighlight = tileCol * diffuse * caustic * 2.0;
    vec3 underColor = underwaterAmbient + causticHighlight + aberration;

    // Smooth blend: transition zone starts 0.3 units below water surface.
    // smoothstep(high, low, y) → 0 at/above surface, 1 fully underwater.
    float underwaterBlend = smoothstep(waterSurfaceY, waterSurfaceY - 0.3, vWorldPosition.y);
    finalColor = mix(aboveColor, underColor, underwaterBlend);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Projected tile caustics fragment shader - for tile meshes with textures + refraction
export const projectedTileCausticsFragmentShader = `
  uniform sampler2D waterTexture;
  uniform vec3 waterPosition;
  uniform float waterSize;
  uniform float chromaticAberration;
  uniform float time;

  uniform sampler2D tileColor;
  uniform sampler2D tileNormal;
  uniform sampler2D tileRoughness;
  uniform vec2 tileRepeat;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    // Project world XZ to water UV space
    vec2 waterUV = (vWorldPosition.xz - waterPosition.xz) / waterSize + 0.5;

    // Tile UVs with repeat
    vec2 tileUv = vUv * tileRepeat;

    // Sample tile textures
    vec3 tileNorm = texture2D(tileNormal, tileUv).rgb * 2.0 - 1.0;
    float roughness = texture2D(tileRoughness, tileUv).r;

    // Subtle time-based distortion
    vec2 distortedUv = waterUV + vec2(
      sin(waterUV.y * 15.0 + time * 0.5) * 0.002,
      cos(waterUV.x * 15.0 + time * 0.5) * 0.002
    );

    // Sample water simulation
    vec4 waterData = texture2D(waterTexture, distortedUv);
    float gx = waterData.b;
    float gy = waterData.a;

    // Caustic intensity from gradient magnitude
    float gradient = length(vec2(gx, gy));
    float caustic = smoothstep(0.0, 0.3, gradient);
    caustic = pow(caustic, 0.5);

    // Roughness affects caustic sharpness
    caustic *= (1.0 - roughness * 0.5);

    // Chromatic aberration
    float caR = texture2D(waterTexture, distortedUv + vec2(chromaticAberration, 0.0)).b;
    float caB = texture2D(waterTexture, distortedUv - vec2(chromaticAberration, 0.0)).b;
    vec3 aberration = vec3(
      smoothstep(0.0, 0.4, abs(caR)) * 0.15,
      0.0,
      smoothstep(0.0, 0.4, abs(caB)) * 0.15
    );

    // Refraction distortion on tile texture
    vec2 refractionOffset = vec2(gx, gy) * 0.02;
    vec3 refractedColor = texture2D(tileColor, tileUv + refractionOffset).rgb;

    // Blend refracted tile color with caustics
    vec3 causticLight = vec3(0.8, 0.9, 1.0) * caustic * 0.6 + aberration;
    vec3 finalColor = refractedColor + causticLight + vec3(caustic * 0.3);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Bubble vertex shader - passes normal and view position for Fresnel
export const bubbleVertexShader = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Bubble fragment shader - Fresnel rim highlight with transparency
export const bubbleFragmentShader = `
  uniform float time;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    vec3 normal = normalize(vNormal);

    // Fresnel - bright rim at grazing angles
    float fresnel = pow(1.0 - abs(dot(viewDir, normal)), 2.5);

    // Specular highlight from light above
    vec3 lightDir = normalize(vec3(0.0, 1.0, 0.0));
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);

    // Subtle iridescence from view angle
    float iAngle = dot(viewDir, normal);
    vec3 iridescence = vec3(
      sin(iAngle * 6.28 + time) * 0.5 + 0.5,
      sin(iAngle * 6.28 + time + 2.094) * 0.5 + 0.5,
      sin(iAngle * 6.28 + time + 4.189) * 0.5 + 0.5
    ) * 0.08;

    vec3 rimColor = vec3(0.7, 0.85, 1.0);
    vec3 finalColor = rimColor * fresnel + iridescence + vec3(1.0) * spec;
    float alpha = fresnel * 0.4 + spec * 0.5;
    alpha = clamp(alpha, 0.03, 0.75);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;
