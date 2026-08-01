# 修复 04/18/19 三课实现问题（第二轮）

## 背景

用户实测反馈 5 个问题，已对照参考项目源码与 Cesium 1.142 源码确认根因：

1. **04 聚合**：数字样式单调，需像参考 `2.3.17、聚合.html` 做分级彩色圆圈
2. **18 粒子**：点击后看不到效果 — 根因：(a) 未设置 `viewer.clock.shouldAnimate = true`，粒子由时钟驱动；(b) 粒子 25px 像素尺寸太小 + 被火星地形遮挡；(c) 参考项目关键参数 `sizeInMeters: true`、大 startScale/endScale 未用
3. **19 Globe 裁剪乌黑一片**：我的实现把"上半球全部切除"（法线朝地心 + distance≈地球半径），露出地心黑洞。参考项目 `4.1.1、地形开挖.html` 是**多边形围成的局部井**：4 条边的竖直裁剪平面（法线朝内）
4. **19 建筑剖面关闭报错 `_target`**：根因确认（`ClippingPlaneCollection.setOwner` 在 `= undefined` 时立即 `destroy()` 旧 collection，但 Model 的 draw command uniformMap 闭包仍引用它 → `clippingPlanes.texture` undefined → `gl.bindTexture(v._target)` 报错）。修复：**关闭时用 `enabled = false`，不置 undefined**
5. **19 淹没水面**：加参考 `4.1.10、水域面.html` 的 Water fabric 动态水面材质

## 改动清单

### 1. 04-cesium-entity.vue — 聚合彩色圆圈

参照参考项目 `2.3.17` 的 clusterEvent 模式：

- 新增 `clusterEvent.addEventListener((clusteredEntities, cluster) => {...})`
- 按 `clusteredEntities.length` 分级：`>200 红 / >100 橙 / >50 绿 / 其余蓝`，颜色/尺寸不同
- 复用参考项目的 `drawImage(text, size, color)` Canvas 画法：实心圆 + 白色数字 + 缓存（Map<"text_size_color", dataURL>）
- 在 `<script lang="ts">` 块导出 `createClusterIcon` 纯函数供测试（返回 data URL，测试只断言函数存在）
- 生成聚合点时 `minimumClusterSize` 设为 1（参考项目如此），保证单个点也有图标

### 2. 18-cesium-particle-system.vue — 粒子可见性修复

参照参考项目 `5.4.1、火焰.html`：

- `viewer.clock.shouldAnimate = true`（粒子系统由时钟驱动，这是看不到效果的核心原因）
- 创建效果时 `viewer.scene.globe.depthTestAgainstTerrain = false`，清除效果时恢复 `true`
- 参数改为参考项目模式：
  - `sizeInMeters: true` + `imageSize` 20~30（米，大粒子）
  - `minimumSpeed/maximumSpeed`（如火焰 1~4 m/s）
  - `minimumParticleLife/maximumParticleLife`（如火焰 1~6s）
  - `loop: true`（lifetime 内循环发射）
  - startScale 0 → endScale 大值（火焰 10 倍膨胀）
- 相机飞近粒子（500~800m，俯角 -20°），不偏移纬度

### 3. 19-cesium-clipping-flood.vue — Globe 裁剪重写为"地形开挖"

参照参考项目 `4.1.1` + `excavateTerrain.js` 的核心算法（简化版）：

- 区域：北京西郊矩形 `[116.30~116.42, 39.85~39.90]`（复用现有 `FLOOD_SAMPLE_BOUNDS` 常量）
- 算法（excavateTerrain.js 第 82-108 行）：
  1. 4 个顶点转 ECEF
  2. 每条边：`midpoint` → `up = normalize(midpoint)`、`right = normalize(next - midpoint)`、`normal = normalize(cross(right, up))`（朝内水平法线）
  3. `distance = Plane.getPointDistance(new Plane(normal, 0), midpoint)`
  4. `globe.clippingPlanes = new ClippingPlaneCollection({ planes, edgeWidth: 1.0, edgeColor })`
- 底面 polygon：土色 `ImageMaterialProperty`（或纯色），高度 = 采样最低高程 − 开挖深度
- 侧壁 wall：4 条边各采样 ~20 点 `sampleTerrainMostDetailed` → `maximumHeights` 地形高 / `minimumHeights` 底面高，土色材质
- **滑块语义改为"开挖深度"**（0~100m），控制底面/侧壁高度，裁剪平面本身不变
- 关闭：`globe.clippingPlanes.enabled = false`（保留引用，不置 undefined），移除底面/侧壁 entity
- `GLOBE_CLIP_CENTER` 等导出常量保留，测试不动

### 4. 19 — 建筑剖面关闭报错修复

根因见背景第 4 点。修改：

- `toggleTilesClip` 关闭分支：`buildingTileset.clippingPlanes.enabled = false`（**不是** `= undefined`）
- Globe 裁剪关闭同理：`enabled = false`
- `onUnmounted` 中销毁 viewer 前：`tileset.clippingPlanes.enabled = false`、`globe.clippingPlanes.enabled = false`（避免 destroy 时序问题，viewer.destroy 自会清理）
- 保持 `tilesClipCollection` / `globeClipCollection` 变量引用直到卸载

### 5. 19 — 淹没水面加动态水材质

参照参考项目 `4.1.10`：

- 新增自定义 `WaterMaterialProperty`（`<script lang="ts">` 块导出）：
  - `getType() { return "Water" }`，`isConstant = false`
  - `getValue(time, result)` 返回 fabric uniforms：`normalMap: Cesium.buildModuleUrl("Assets/Textures/waterNormals.jpg")`（vite-plugin-cesium 已处理该资源路径）、`frequency: 1000`、`animationSpeed: 0.01`、`amplitude: 10`
- 淹没水面 Entity 的 `material` 从 `ColorMaterialProperty` 换成 `new WaterMaterialProperty()`，高度动画（CallbackProperty 水位）保持不变

## 验证方式

```bash
cd frontend && npx vitest run     # 现有 30 个测试 + catalog 断言
cd frontend && npm run build      # 类型检查 + 构建
npm run dev                       # 浏览器逐项验证：
# 04：生成点 → 放大/缩小 → 聚合数字带彩色圆圈
# 18：三个效果点击后能看到粒子喷发动画
# 19：开挖井（底+壁可见）、关闭不报错、建筑剖面开/关不报错、淹没水面有波纹动画
```

## 影响范围

仅 3 个页面文件（04/18/19）。测试文件无需改动（导出常量保持兼容）。
