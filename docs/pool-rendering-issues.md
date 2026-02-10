# CausticsPool 렌더링 이슈 & 해결 기록

## 배경

바닥면(CausticsTile)을 BoxGeometry 기반 풀(Pool) 구조로 확장하면서 발생한 렌더링 이슈들을 정리한다.

---

## Issue 1: 투명한 앞벽 뒤의 뒷벽이 흰색으로 보임

### 상황

- BoxGeometry에 `transparent: true`를 설정
- 카메라를 향한 벽(앞벽)은 `opacity → 0` (투명), 반대편 벽(뒷벽)은 `opacity → 1` (불투명)
- 그런데 뒷벽이 흰색(배경색)으로 렌더링됨

### 원인: Depth Buffer 선점

```
카메라 → [앞벽 (투명)] → [뒷벽 (불투명)]
```

WebGL에서 `transparent: true` + `depthWrite: true`(기본값)인 경우:

1. GPU가 앞벽 fragment를 먼저 처리 → depth buffer에 앞벽의 z값을 기록
2. 뒷벽 fragment를 처리하려 할 때 depth test 실행
3. 뒷벽은 앞벽보다 멀리 있으므로 **depth test 실패** → fragment 폐기
4. 앞벽은 alpha ≈ 0이라 거의 안 보이고, 뒷벽은 렌더링되지 않음 → **배경색(흰색)만 보임**

핵심: 단일 mesh 내에서 face들의 렌더링 순서는 보장되지 않는다. 투명한 앞면이 먼저 렌더링되면 depth buffer를 선점하여 뒤의 불투명 면을 차단한다.

### 1차 해결: depthWrite: false

```js
new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,  // depth buffer에 쓰지 않음
})
```

- 어떤 face도 depth buffer에 기록하지 않으므로 뒷벽이 가려지지 않음
- 단점: 이 mesh가 다른 오브젝트를 가리지 못함 (depth 정보 없음)

---

## Issue 2: 위에서 내려볼 때 수면 아래 바닥이 안 보임

### 상황

- WaterSurface에 `MeshPhysicalMaterial` + `transmission: 1` 적용
- 옆에서 보면 반사광이 잘 보이는데, 위에서 내려보면 바닥 타일이 안 보임

### 원인: Transmission Render Pass와 transparent 오브젝트

Three.js의 `transmission`(물리 기반 투과) 작동 방식:

```
1단계: transmissionRenderTarget에 씬을 렌더링 (배경 캡쳐)
2단계: transmission 오브젝트가 이 텍스쳐를 샘플링하여 뒤의 장면을 보여줌
```

문제는 **1단계에서 `transparent: true`인 오브젝트는 제외**된다는 것이다.

```
CausticsPool (transparent: true) → transmission 렌더 타겟에 안 잡힘
                                  → WaterSurface가 "뒤에 아무것도 없다"고 판단
                                  → 바닥이 안 보임
```

Three.js 렌더링 파이프라인:
```
1. Opaque 오브젝트 렌더링           ← transmission 렌더 타겟은 여기만 캡쳐
2. Transmission 오브젝트 렌더링      ← WaterSurface
3. Transparent 오브젝트 렌더링       ← CausticsPool (여기 있으면 캡쳐 안 됨)
```

### 최종 해결: discard 기반으로 opaque 유지

카메라를 향한 벽의 투명 처리 방식을 alpha blending → discard로 변경:

**Before (alpha blending):**
```glsl
// fragment shader
float opacity = smoothstep(0.3, -0.1, facing);
gl_FragColor = vec4(finalColor, opacity);  // alpha 값으로 투명도 조절
```
```js
// material
{ transparent: true, depthWrite: false }
```

**After (discard):**
```glsl
// fragment shader
if (facing > 0.0) discard;                // 카메라 향한 면은 아예 폐기
gl_FragColor = vec4(finalColor, 1.0);      // 나머지는 완전 불투명
```
```js
// material - transparent/depthWrite 불필요
{ side: THREE.DoubleSide }
```

결과:
- CausticsPool이 **opaque 오브젝트**로 분류됨
- transmission 렌더 타겟에 바닥이 정상 캡쳐됨
- 위에서 내려볼 때 수면 너머로 바닥 타일이 보임
- depth buffer도 정상 작동하여 뒷벽 흰색 문제도 해결

---

## Issue 3: 수면의 물 느낌 부족

### 상황

- 처음에 `transparent: true` + `opacity: 0.35`로 투명하게 만들었으나 반사가 없어서 물처럼 안 보임

### 원인

`opacity` 기반 투명도는 단순히 색상의 alpha를 낮출 뿐, 물리적인 빛 반사/굴절을 시뮬레이션하지 않는다.

### 해결: MeshPhysicalMaterial + transmission + Environment Map

레퍼런스(`water-caustics.js`)에서 추출한 물 표면 머티리얼 설정:

```js
new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  transmission: 1,          // 완전 투과 (빛이 통과)
  ior: 1.935,               // 굴절률 (물: 1.33, 유리: 1.5, 이 값은 과장된 굴절)
  thickness: -0.15,          // 음수 thickness로 독특한 굴절 효과
  roughness: 0.1,           // 낮은 거칠기 → 선명한 반사
  metalness: 0,             // 비금속 (dielectric) → Fresnel 반사
  clearcoat: 0.05,          // 투명 코팅층 → 추가 반사
  clearcoatRoughness: 0.1,
  specularIntensity: 0.2,   // 스펙큘러 강도
})
```

추가로 필요한 씬 요소:
```jsx
<spotLight position={[0, 10, 0]} intensity={2.5} angle={0.55} />  // 방향성 조명
<Environment preset="sunset" />                                     // 환경맵 (반사 소스)
```

`transmission`이 `opacity`보다 우수한 이유:
- **Fresnel 효과**: 수직으로 보면 투명, 비스듬히 보면 반사 (실제 물의 광학 특성)
- **IOR 기반 굴절**: 빛이 통과할 때 왜곡되어 자연스러움
- **환경맵 반사**: 주변 환경이 수면에 비침

---

## 핵심 교훈

| 개념 | 설명 |
|------|------|
| **Depth Buffer** | 각 픽셀의 카메라로부터의 거리를 저장. `depthWrite`가 true면 렌더링 시 기록, `depthTest`가 true면 기존 값과 비교하여 가려진 면 폐기 |
| **transparent 분류** | Three.js는 `transparent: true`인 mesh를 별도 렌더 큐에 넣어 opaque 이후에 렌더링 |
| **transmission 렌더 패스** | opaque 오브젝트만 캡쳐하므로, 뒤에 있는 오브젝트가 transparent면 투과 효과에 안 잡힘 |
| **discard vs alpha** | `discard`는 fragment를 완전히 폐기 (depth에도 안 씀). alpha blending은 색상만 혼합하되 depth는 기록될 수 있음 |
| **Fresnel 효과** | 시선 각도에 따라 반사/투과 비율이 달라지는 물리 현상. 수직 → 투과 우세, 비스듬 → 반사 우세 |
