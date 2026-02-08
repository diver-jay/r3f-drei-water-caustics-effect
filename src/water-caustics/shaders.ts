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

// Caustics shader - renders the caustic effect with chromatic aberration
export const causticsVertexShader = `
  uniform float rotationAngle;
  varying vec2 vUv;

  void main() {
    float c = cos(rotationAngle);
    float s = sin(rotationAngle);
    mat2 rotationMatrix = mat2(c, -s, s, c);
    vUv = (rotationMatrix * (uv - 0.5)) + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const causticsFragmentShader = `
  uniform sampler2D waterTexture;
  uniform sampler2D tileColor;
  uniform sampler2D tileNormal;
  uniform sampler2D tileRoughness;
  uniform float chromaticAberration;
  uniform float time;
  uniform vec2 tileRepeat;
  varying vec2 vUv;

  void main() {
    // Tile UVs with repeat
    vec2 tileUv = vUv * tileRepeat;

    // Sample tile textures
    vec3 baseColor = texture2D(tileColor, tileUv).rgb;
    vec3 tileNorm = texture2D(tileNormal, tileUv).rgb * 2.0 - 1.0;
    float roughness = texture2D(tileRoughness, tileUv).r;

    // Sample the water simulation texture
    vec2 distortedUv = vUv + vec2(
      sin(vUv.y * 15.0 + time * 0.5) * 0.002,
      cos(vUv.x * 15.0 + time * 0.5) * 0.002
    );

    vec4 waterData = texture2D(waterTexture, distortedUv);

    // Get gradient values (stored in b and a channels after normal calculation)
    float gx = waterData.b;
    float gy = waterData.a;

    // Calculate caustic intensity from gradients
    float gradient = length(vec2(gx, gy));

    // Create sharp caustic lines
    float caustic = smoothstep(0.0, 0.3, gradient);
    caustic = pow(caustic, 0.5);

    // Roughness affects caustic sharpness — smoother surfaces show brighter caustics
    caustic *= (1.0 - roughness * 0.5);

    // Add subtle chromatic aberration
    float caR = texture2D(waterTexture, distortedUv + vec2(chromaticAberration, 0.0)).b;
    float caB = texture2D(waterTexture, distortedUv - vec2(chromaticAberration, 0.0)).b;

    vec3 aberration = vec3(
      smoothstep(0.0, 0.4, abs(caR)) * 0.15,
      0.0,
      smoothstep(0.0, 0.4, abs(caB)) * 0.15
    );

    // Water refraction distortion on the tile based on water normals
    vec2 refractionOffset = vec2(gx, gy) * 0.02;
    vec3 refractedColor = texture2D(tileColor, tileUv + refractionOffset).rgb;

    // Blend refracted tile color with caustics
    vec3 causticLight = vec3(0.8, 0.9, 1.0) * caustic * 0.6 + aberration;
    vec3 finalColor = refractedColor + causticLight + vec3(caustic * 0.3);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;
