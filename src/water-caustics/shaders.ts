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
