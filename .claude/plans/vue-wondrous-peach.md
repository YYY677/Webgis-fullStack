# Cesium 学习页面 04-05 计划

## Context

Cesium Demo 系列已有 3 页（初识 / 坐标方位 / 事件监听），每页一个单 Vue 文件、左侧 el-card 面板 + 底图切换。

接下来先学 Entity 和 Primitive 两个核心概念，数据加载（06）留到后面，因为需要 Entity/Primitive 的基础知识。

## 原则

- 学习导向 — 介绍常用重要概念，不写无关逻辑增加理解负担
- 每个卡片聚焦一个子主题，用按钮/开关触发操作，不做复杂表单
- 复用 01-03 的 UI 模式（`#cesiumContainer` + `.left-panel` + `el-card` + basemap switcher）
- 不抽取 composable（每页独立 Viewer，与现有模式一致）

## 路由变更

`frontend/src/router/index.ts` 的 `cesium-demo` children 追加 2 条：

```ts
{
  path: "entity",
  name: "CesiumEntity",
  component: () => import("@/pages/cesium-frontend-demo/04-cesium-entity.vue"),
  meta: { title: "04-Entity" },
},
{
  path: "primitive",
  name: "CesiumPrimitive",
  component: () => import("@/pages/cesium-frontend-demo/05-cesium-primitive.vue"),
  meta: { title: "05-Primitive" },
},
```

---

## 04-cesium-entity.vue — Entity API

### 内容组织（4 个 panel-card，含底图标签）

**卡片 1: 点状要素 — Point · Billboard · Label**
三种标注方式同位置展示，方便对比：
- "添加标记点" → `viewer.entities.add({ position, point: { pixelSize: 12, color: Color.RED } })`
- "添加图标" → `viewer.entities.add({ position, billboard: { image: "/pin.svg", scale: 1.5 } })`
- "添加文字标签" → `viewer.entities.add({ position, label: { text: "北京", font: "16px sans-serif", fillColor: Color.WHITE } })`
- 一个"清除点要素"按钮移除本卡片创建的 entity

**卡片 2: 线面要素 — Polyline · Polygon · Rectangle**
- "添加折线" → 4 个点 `positions` + `width: 4` + `material: Color.ORANGE`
- "添加多边形" → 5 个点 `hierarchy` + `material: new ColorMaterialProperty(Color.GREEN.withAlpha(0.5))` + `outline: true`
- "添加矩形" → `Rectangle.fromDegrees(...)` + `material: Color.BLUE.withAlpha(0.3)`
- 一个"清除线面要素"按钮

**卡片 3: 三维体 — Box · Cylinder · Ellipsoid**
- "添加立方体" → `BoxGraphics({ dimensions: new Cartesian3(400000, 400000, 400000), material: Color.RED })`
- "添加圆柱" → `CylinderGraphics({ length: 500000, topRadius: 100000, bottomRadius: 200000, material: Color.GREEN })`
- "添加椭球" → `EllipsoidGraphics({ radii: new Cartesian3(200000, 300000, 400000), material: Color.BLUE.withAlpha(0.5) })`
- 每项添加后 `viewer.flyTo(entity)` 到物体位置
- 一个"清除三维体"按钮

**卡片 4: Entity 属性编辑**
- 用两个 el-slider 选中某个 entity 并修改其属性（如调整已有多边形的透明度、大小）
- 展示 `entity.polygon.material = new ColorMaterialProperty(...)` 的运行时更新能力

### 关键 API 清单
- `viewer.entities` / `viewer.entities.add()` — EntityCollection
- `position: Cartesian3.fromDegrees()`
- `point: PointGraphics({ color, pixelSize })`
- `billboard: BillboardGraphics({ image, scale })`
- `label: LabelGraphics({ text, font, fillColor })`
- `polyline: PolylineGraphics({ positions, width, material })`
- `polygon: PolygonGraphics({ hierarchy, material })`
- `rectangle: RectangleGraphics({ coordinates, material })`
- `box: BoxGraphics({ dimensions, material })`
- `cylinder: CylinderGraphics({ length, topRadius, bottomRadius })`
- `ellipsoid: EllipsoidGraphics({ radii, material })`
- `ColorMaterialProperty`, `Color.withAlpha()`
- `viewer.flyTo(entity)`
- `viewer.entities.remove(entity)` / `viewer.entities.removeAll()`

---

## 05-cesium-primitive.vue — Primitive API

### 内容组织（3 个 panel-card）

**卡片 1: 基础几何体 — GeometryInstance + Appearance**
- "创建三角形" → `new GeometryInstance({ geometry: new PolygonGeometry.fromPositions(...) })` + `new PerInstanceColorAppearance({ flat: true })`
- "创建矩形" → `new GeometryInstance({ geometry: new RectangleGeometry(...) })` + `new PerInstanceColorAppearance()`
- "创建线段" → `new GeometryInstance({ geometry: new PolylineGeometry(...) })` + `new PolylineColorAppearance()`
- `scene.primitives.add(primitive)`
- 每个按钮创建后简短注释解释底层逻辑

**卡片 2: 材质外观 — MaterialAppearance**
- "棋盘格多边形" → `MaterialAppearance({ material: Material.fromType("Checkerboard") })`
- "条纹圆形" → `new CircleGeometry(...)` + `MaterialAppearance({ material: Material.fromType("Stripe") })`
- "网格面" → `MaterialAppearance({ material: Material.fromType("Grid") })`
- 展示 Material.fromType 的几种内置材质，并说明材质系统与 Entity 的不同

**卡片 3: Entity vs Primitive 对照**
- 左侧按钮用 Entity 创建一个多边形，右侧按钮用 Primitive 创建同样的多边形
- 重点注释：Primitive 共用 Geometry + Appearance 实例，适合大量对象；Entity 更高层但每对象独立开销
- "批量创建"按钮：分别用 Entity 和 Primitive 创建 100 个点或小立方体，直观感受性能差异

### 关键 API 清单
- `GeometryInstance({ geometry, id, modelMatrix })`
- `PerInstanceColorAppearance({ flat, translucent })`
- `MaterialAppearance({ material })`
- `Material.fromType("Checkerboard" | "Stripe" | "Grid" | "ColorRamp")`
- `PolylineColorAppearance` / `PolylineMaterialAppearance`
- `PolygonGeometry` / `PolygonGeometry.fromPositions()`
- `RectangleGeometry` / `CircleGeometry` / `BoxGeometry`
- `PolylineGeometry`
- `scene.primitives.add(primitive)` / `scene.primitives.remove(primitive)` / `scene.primitives.removeAll()`

---

## 需要修改的文件

| 文件 | 变更 |
|------|------|
| `frontend/src/router/index.ts` | cesium-demo children 追加 2 条 route |
| `frontend/src/pages/cesium-frontend-demo/04-cesium-entity.vue` | **新建** |
| `frontend/src/pages/cesium-frontend-demo/05-cesium-primitive.vue` | **新建** |

## 不需要变更

- `MainLayout.vue` — 侧边栏菜单自动根据 route 显示
- `cesium-basemaps.ts` / `CesiumBasemapSwitcher.vue` — 复用已有
- composables — 每页独立 Viewer

## 验证方式

1. `npm run dev` 启动前端
2. 侧边栏出现 "04-Entity"、"05-Primitive"
3. 04 页每个卡片按钮能创建对应图形，清除按钮正常
4. 05 页 Primitive 创建正常，性能对照按钮能看到差异
5. `npm run build` 类型检查 + 构建通过
