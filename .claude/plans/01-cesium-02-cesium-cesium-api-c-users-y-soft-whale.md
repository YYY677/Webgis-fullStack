# 02-cesium-coordinates.vue — Cesium 方位角与坐标系

## Context

已有 `01-cesium-entry.vue`（底图切换），需要创建 **02-cesium-coordinates.vue**，从两个参考 HTML（基于 Cesium 1.98）中移植两个核心专题：

1. **相机姿态控制**（Heading/Pitch/Roll → 方位角/俯仰角/滚转角）
2. **坐标系拾取**（屏幕坐标 → 椭球面 → 场景 → 地表）

项目使用 **Cesium 1.142**（ES module，非全局 `Cesium.`），所有 API 需适配。

## 改动文件

| 操作 | 文件 | 说明 |
|------|------|------|
| **CREATE** | `frontend/src/pages/cesium-frontend-demo/02-cesium-coordinates.vue` | 组件 |
| **MODIFY** | `frontend/src/router/index.ts` | 添加路由 |

无需改动 `cesium-basemaps.ts` / `CesiumBasemapSwitcher.vue` — 直接复用。

## 路由

`/cesium-demo` 下新增子路由：

```ts
{
  path: "coordinates",
  name: "CesiumCoordinates",
  component: () => import("@/pages/cesium-frontend-demo/02-cesium-coordinates.vue"),
  meta: { title: "02-坐标与方位角" },
}
```

## 组件设计

### 布局结构

同 `01-cesium-entry` 的 `#cesiumContainer` + 浮动面板模式，顶部右上底图切换 + 左下底图标签。左侧新增多卡片面板：

```
┌─────────────────────────────────┐
│ [左上控制面板]           [底图切换] │
│ ┌─ 相机姿态控制 ──────────┐      │
│ │ Heading  [===○===]  45° │      │
│ │ Pitch   [===○===] -30°  │      │
│ │ Roll    [=○=====]  10°  │      │
│ │ [重置] [俯视] [侧视]     │      │
│ └─────────────────────────┘      │
│ ┌─ 相机坐标 ────────────────┐      │
│ │ 经度: 116.39°             │      │
│ │ 纬度: 39.91°              │      │
│ │ 高度: 2000000.00m         │      │
│ │ Cartesian3: (x, y, z)     │      │
│ │ Cartographic: (rad...)    │      │
│ └─────────────────────────┘      │
│ ┌─ 鼠标拾取坐标 ────────────┐      │
│ │ 屏幕坐标: (x, y)          │      │
│ │ 椭球交点: lon, lat, h     │      │
│ │ 场景位置: lon, lat, h     │      │
│ │ 地表位置: lon, lat, h     │      │
│ └─────────────────────────┘      │
└─────────────────────────────────┘
```

### 三个功能面板

**面板 1 — 相机姿态控制**（对应参考 1.3）
- `el-slider` × 3：Heading 0–360 / Pitch -90–90 / Roll -180–180，step=0.1
- `el-button` × 3：重置 (0,-90,0) / 俯视 (0,-90,0) / 侧视 (90,0,0)
- 滑块 → `camera.setView({ orientation: {...} })`
- 防循环：`updatingFromCamera` 守卫标志

**面板 2 — 相机坐标**（对应参考 1.3）
- 只读显示，`scene.postRender` 每帧同步
- 显示值：经度/纬度/高度（度）、Heading/Pitch/Roll（度）、Cartesian3 字符串、Cartographic 字符串
- 通过 `camera.positionCartographic` 获取，`CesiumMath.toDegrees()` 转换

**面板 3 — 鼠标拾取坐标**（对应参考 1.4）
- `ScreenSpaceEventHandler` 监听 `LEFT_CLICK`
- 四种坐标同时显示：
  - 屏幕像素坐标（原生 `{x, y}`）
  - 椭球交点 — `camera.pickEllipsoid()`
  - 场景位置 — `scene.pickPosition()`（含地形/模型，需 `depthTestAgainstTerrain = true`）
  - 地表位置 — `globe.pick(ray)`（含地形不含模型）
- 每个位置同时显示 Cartesian3 和经纬度（度）

### Cesium 1.142 API 适配要点

| 旧版 1.98 | 1.142 (本项目) |
|-----------|----------------|
| `Cesium.XXX` 全局 | `import { XXX } from "cesium"` |
| `Cesium.Math.toRadians()` | `CesiumMath.toRadians()`（别名防冲突） |
| `Cesium.Cartesian3.fromDegrees()` | `Cartesian3.fromDegrees()` |
| `Cesium.Cartographic.fromDegrees()` | `Cartographic.fromDegrees()` |
| `new Cesium.Cartesian3(x,y,z)` | `new Cartesian3(x,y,z)` |
| `new Cesium.Cartographic(lon,lat,h)` | `new Cartographic(lon,lat,h)` |
| `new Cesium.ScreenSpaceEventHandler()` | `new ScreenSpaceEventHandler()` |
| `Cesium.ScreenSpaceEventType.LEFT_CLICK` | `ScreenSpaceEventType.LEFT_CLICK` |
| `scene.postRender.addEventListener()` | 同为 `scene.postRender.addEventListener()`（Cesium Event API 稳定） |

### 关键实现细节

1. **防循环守卫**：`syncCameraToUI`（postRender → 写 ref）和 `applyCameraOrientation`（滑块 → 写 camera）通过 `updatingFromCamera` 互锁，避免回调振荡
2. **初始化视角**：`onMounted` 后飞到北京上空 `(116.39, 39.91, 2000000)` 方便测试
3. **清理**：`onUnmounted` 中 destroy viewer + destroy handler + 移除 postRender 监听
4. **类型接口**：`ClickPickInfo` 接口定义鼠标拾取结果的结构

### 样式

- 布局同 01-cesium-entry（`.map-container`, `.panel-overlay`, 底图标签）
- 新增 `.left-panel` 绝对定位左侧，`width: 340px`，`max-height: calc(100% - 60px)`
- 卡片用 Element Plus `el-card`，内边距统一 12px
- 滑块行用 flex 布局：label + el-slider(flex:1) + 数值显示
- Element Plus 暗黑模式自动继承（无需额外样式）

## 验证

1. `cd frontend && npm run build` — TypeScript 类型检查通过无报错
2. 启动 `npm run dev`，导航到 `/cesium-demo/coordinates`
3. 验证：拖动滑块 → 相机姿态变化；点击地图 → 弹出四种坐标信息
