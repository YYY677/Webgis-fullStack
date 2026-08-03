---
name: cesium-lighting
description: Cesium 光照体系 — 太阳方向=模拟时钟时间、scene.light/DirectionalLight 语义与强度坑、各类对象受光范围
metadata:
  type: reference
---

# Cesium 光照（太阳/光源）体系

## 光源 = scene.light，默认 SunLight

- `scene.light` 默认 `new SunLight()`（Scene.js:762）。
- **太阳方向完全由模拟时钟决定**：`UniformState.setSunAndMoonDirections` → `Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(frameState.time)`，`frameState.time` = `viewer.clock.currentTime`。所以"真实时间影响光照"本质是"模拟时钟时间影响光照"。
- Clock 默认 `currentTime = JulianDate.now()`（页面打开那一刻）、multiplier 1.0；Viewer 默认 `shouldAnimate = false` → 光照冻结在打开时刻；开动画或调 multiplier → 太阳随时间移动/加速。
- 调时间即调太阳：`viewer.clock.currentTime = JulianDate.fromDate(new Date("2026-06-21T12:00:00+08:00"))`（北京正午 = UTC 04:00）+ `shouldAnimate = false`。

## DirectionalLight 两个坑

1. **direction 是光线行进方向，不是光源位置**：shader 取 `lightDirectionWC = -normalize(light.direction)`（UniformState.js:1465 非 SunLight 分支）。想让光源在方向 S → direction 传 **S 的对跖点**（经度 ±180°，纬度取反）。例：模拟北京夏至正午太阳 (116.39°E, 23.44°N) → `fromDegrees(-63.61, -23.44)`。写反则光源在地底下、受光面全反，**调强度无效**（受光面 NdotL ≤ 0，与强度无关）。
2. **intensity 默认 1.0，SunLight 默认 2.0**：模型直射光 = `光色 × intensity × BRDF`（LightingStageFS.glsl 用 `czm_lightColorHdr`），换灯后亮度减半，需手动 `intensity: 2.0`。

## 受光范围

- **Globe 地形**：`globe.enableLighting` 默认 false，开启才受昼夜光照。
- **3D Tiles / glTF/glb（Model 管线）**：PBR 材质**总是**受直射光，已无 enableLighting 开关；调 `model.lightColor` / `tileset.lightColor`（默认 undefined → 用 scene.light）。
- **普通 Entity/Appearance 图元（polygon/wall 等）**：默认走 `czm_phong`——漫反射用**固定方向**（顶视 + 3D 加"上方"），**只有高光用场景光方向**；自带 0.5×diffuse 环境光永不黑，所以光源方向变化几乎看不出来。设 `flat: true`（EllipsoidSurfaceAppearance/MaterialAppearance 选项）则完全无光照。
- **billboard / point / label**：完全不受光（颜色直出）。
- **阴影**：`scene.shadowMap.enabled` + 对象 `castShadows/receiveShadows`；阴影相机方向 = 光源方向（Scene.js:4335 对 SunLight 特殊处理，取反太阳方向）。

## 正午模拟两方案

1. **推荐**：保留 SunLight 只调时钟（天文算法天然正确，且随地点自适应）。
2. **固定 DirectionalLight**：方向 = 同经度 + 赤纬纬度的**对跖点**；仰角 = 90° - |纬度 - 赤纬|（北京 39.9°N：夏至 73.5°、春秋分 50.1°、冬至 26.7°）。
