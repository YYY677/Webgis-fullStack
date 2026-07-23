# Cesium 学习页面 06 — 数据加载

## Context

学完 Entity 和 Primitive 后，自然要学习如何在 Cesium 中加载外部数据。
Cesium 支持多种数据格式，本页覆盖最常用的四种：GeoJSON、3D Tiles、glTF 模型、CZML。

## 数据准备

从 `C:\Users\YU\Desktop\Cesium-Examples-main\examples\cesiumEx\` 复制到 `frontend/public/cesium-data/`：

```
cesium-data/
├── tiles-buildings/          # 3D Tiles（建筑白模，6.8MB，每个面有 height 属性）
│   ├── tileset.json
│   ├── scenetree.json
│   └── NoLod_0.b3dm
├── tiles-oblique/            # 3D Tiles（倾斜摄影，13MB，LOD 多级）
│   ├── tileset.json
│   ├── scenetree.json
│   ├── NoLod_0.b3dm / .cmpt
│   ├── NoLod_1.b3dm / .cmpt
│   └── NoLod_2.cmpt
├── models/                   # 模型文件
│   # --- 单文件 glb（自包含，直接加载）---
│   ├── feiji.glb             # ✈️ 客机（1.8MB）
│   ├── zhanji.glb            # 🛩️ 战斗机（4.1MB）
│   ├── wajueji.glb           # 🚜 挖掘机（1.9MB）
│   ├── Man.glb               # 🧑 人物（480KB）
│   │
│   # --- 单文件 gltf（自包含，同 glb 加载方式）---
│   ├── xiaofangche.gltf      # 🚒 消防车（2.6MB）
│   ├── weixin.gltf           # 💬 微信图标（464KB）
│   │
│   # --- 多文件 gltf（目录结构，加载入口是 scene.gltf）---
│   ├── porsche_918/          # 🏎️ 保时捷（2.4MB）
│   │   ├── scene.gltf
│   │   ├── scene.bin
│   │   └── textures/
│   ├── su7/                  # 🚗 小米 SU7（84KB）
│   │   ├── scene.gltf
│   │   ├── scene.bin
│   │   └── textures/
│   ├── missile/              # 🚀 导弹（96KB）
│   │   ├── scene.gltf
│   │   └── textures/
│   └── dji_tello/            # 🛸 无人机（36KB）
│       ├── scene.gltf
│       ├── scene.bin
│       └── textures/
├── gj.json                   # 🗺️ 国界 GeoJSON（304KB）
├── anzhouBorder.json         # 📍 边界 GeoJSON（12KB，适合快速测试）
└── wx.czml                   # 🛰️ 卫星轨道 CZML（392KB，时间动画）

## CZML 说明

```json
// 示例：CZML 是 JSON 数组，每个元素是一个 packet
[
  { "id": "document",                     // 第一个 packet 必须是 document
    "version": "1.0",
    "clock": { "interval": ".../...",     // 时间范围
               "currentTime": "...",
               "multiplier": 60 } },      // 60 倍速
  { "id": "Satellite/GF-7",
    "position": { "epoch": "...",
                  "cartesian": [ ... ] }, // 时间+位置序列
    "billboard": { "image": "...", ... },
    "path": { ... } }
]
```

## 内容组织（4 个 panel-card）

### 卡片一：GeoJSON 加载
- "加载国界" → `GeoJsonDataSource.load("/cesium-data/gj.json")` → `viewer.dataSources.add(ds)`
- "加载边界" → `GeoJsonDataSource.load("/cesium-data/anzhouBorder.json")`
- 加载后自动用默认样式渲染
- 展示 DataSource 级别的样式设置：`GeoJsonDataSource.load(url, { stroke: Color.RED })`
- "清除数据源"按钮

### 卡片二：3D Tiles
- "加载建筑白模" → `Cesium3DTileset.fromUrl("/cesium-data/tiles-buildings/tileset.json")`
- "加载倾斜摄影" → `Cesium3DTileset.fromUrl("/cesium-data/tiles-oblique/tileset.json")`
- 加载后 `viewer.scene.primitives.add(tileset)`，飞入视角
- 说明 3D Tiles 的 LOD 机制（refine: REPLACE）
- "清除 3D Tiles"按钮

### 卡片三：glTF 模型（全面展示）
- **Entity 方式加载模型列表**（4 个按钮，不同位置展示）：
  - "添加客机" → `viewer.entities.add({ position, model: { uri: "/cesium-data/models/feiji.glb", scale: 1 } })`
  - "添加人物" → `viewer.entities.add({ position, model: { uri: "/cesium-data/models/Man.glb" } })`
  - "添加挖掘机" → `viewer.entities.add({ position, model: { uri: "/cesium-data/models/wajueji.glb" } })`
  - "添加微信图标" → `viewer.entities.add({ position, model: { uri: "/cesium-data/models/weixin.gltf" } })`
  每个在不同位置（分散布局），自动飞入视角
- **Primitive 方式加载**（对比展示）：
  - "Primitive 加载模型" → `Model.fromUrl({ url: "/cesium-data/models/feiji.glb" })` → `scene.primitives.add(model)`
  - 放在与 Entity 相同的模型旁边，展示两者效果一致，只是 API 不同
- 说明差异：Entity 自动管理生命周期 + 关联属性，Primitive 更底层但性能更好
- "清除模型"按钮

### 卡片四：CZML 时间动态
- "加载卫星轨道" → `CzmlDataSource.load("/cesium-data/wx.czml")` → `viewer.dataSources.add(ds)`
- CZML 是 Cesium 专有的 JSON 时间序列格式，以"packet"为单位描述对象
- 启动时钟动画：`viewer.clock.shouldAnimate = true`
- 可选择切换时间速度
- "清除 CZML"按钮

## 关键 API
- `GeoJsonDataSource.load()` / `viewer.dataSources`
- `Cesium3DTileset.fromUrl()` / `tileset.readyPromise`
- Entity 方式：`viewer.entities.add({ model: { uri } })`
- Primitive 方式：`Model.fromUrl({ url })` → `scene.primitives.add()`
- `CzmlDataSource.load()`
- `viewer.clock.shouldAnimate` / `clock.multiplier`

## 需要修改/新增的文件
| 文件 | 变更 |
|------|------|
| `frontend/src/router/index.ts` | cesium-demo children 追加 06 路由 |
| `frontend/src/pages/cesium-frontend-demo/06-cesium-data.vue` | **新建** |
| `frontend/public/cesium-data/` | **新建目录** + 复制所有数据文件 |

## 验证方式
1. `npm run dev` 启动，侧边栏出现 "06-数据加载"
2. GeoJSON 卡片：加载国界/边界正常显示
3. 3D Tiles 卡片：建筑白模和倾斜摄影加载成功，自动飞入
4. 模型卡片：5 个模型正确显示在不同位置，Entity/Primitive 方式都正常
5. CZML 卡片：卫星轨道加载，时钟动画运行
6. 每个卡片清除按钮正常
7. `npm run build` 通过
