# Cesium WebGIS Demo 项目参考指南

> 源码位置：`C:\Users\YU\Desktop\ceisum示例\src`。项目 README 标识为 `webgis-demo`，本指南按可迁移能力整理其源码，而不是按文件夹机械罗列。

## 项目定位与版本边界

该参考项目是一个 Vue Demo 画廊，不是单一 Cesium 应用：它用 Vue Router 动态加载 47 个示例，其中注册表 `src/components/gallery-index.js` 记录 38 个 `public` 示例和 9 个 `three` 示例。`public` 目录以 Cesium 为主，但也混有纯 Three.js 的 `map_3d.vue` 与性能可视化页面。

| 项目 | 框架与依赖 | 工程判断 |
| --- | --- | --- |
| 参考项目 | Vue `3.2.13`、Vue CLI `5`、Vuex、Element Plus `2.2.17`、Cesium `1.111.0`、Three `0.137.0` | 适合学习独立渲染和交互原型。 |
| 当前项目 | Vue 3、TypeScript、Vite、Pinia、Cesium `1.142.0` | 以 composable、类型和统一 Viewer 生命周期承接可复用能力。 |

**结论：** 可以复用功能拆分、交互状态机和渲染同步思路；不能直接复制 Options API 单文件结构、Vue CLI 资源路径、旧 API、硬编码 Token 或外部服务地址。

## 画廊架构

```text
gallery-index.js（Demo 元数据 + 动态 import）
  → router/index.js（拼接 Hash 路由并写入页面标题）
  → HomeView.vue（缩略图网格）
  → 单个 .vue Demo（mounted 中创建 Viewer 或 WebGLRenderer）
```

| 文件 | 做法 | 可迁移价值 |
| --- | --- | --- |
| `src/components/gallery-index.js` | 一个数组定义标题、缩略图、路由路径和动态组件导入。 | 可作为本项目 Cesium 学习目录的元数据来源；应改为 TypeScript 类型和 Vite `import.meta.glob`。 |
| `src/router/index.js` | 将首页路由与 Demo 路由合并，使用 Hash History，并在守卫中更新 `document.title`。 | 元信息驱动标题的做法可保留；路由边界应沿用当前项目的嵌套路由。 |
| `src/views/HomeView.vue` | 以 Element Plus 响应式栅格展示 Demo GIF，点击进入路由。 | 可借鉴展示方式，但缩略图的导入、无障碍文本和失败回退需补齐。 |
| `src/main.js` | 在入口设置 `Ion.defaultAccessToken`。 | **不应照抄。** Token 不应提交源码；当前项目从环境配置或服务端获取。 |

## Demo 分类索引

下表按能力组织全部注册 Demo。每个条目的源文件均位于 `src/components/<目录>/<名称>.vue`。

### 1. 绘制、拾取与交互

| Demo | 关键实现 | 复用建议 |
| --- | --- | --- |
| `draw_point`、`draw_line`、`draw_circle`、`draw_polygon` | `CustomDataSource`、`ScreenSpaceEventHandler`、`CallbackProperty`，右键结束绘制。 | 可抽取为统一绘制状态机；必须在卸载时 `destroy()` handler，并处理 3D Tiles、地形和椭球三种拾取路径。 |
| `select_hightlight` | 点击 3D Tiles 后保存颜色并高亮。 | 仅适合无样式模型；当 `Cesium3DTileStyle` 已激活时不宜直接改 `feature.color`。 |
| `select_hightlight_instance` | 用 `getGeometryInstanceAttributes(id)` 修改实例色。 | 可借鉴“缓存原始属性再恢复”的模式；需要检查 Primitive 是否仍在场景中。 |
| `info_window` | 选中对象后展示信息窗口。 | 应改为 Vue 状态驱动的弹层，并在相机变化时更新屏幕位置。 |
| `rotate_arround` | 相机绕目标点旋转。 | 可抽成可取消的相机控制任务，避免与用户输入形成竞争。 |

### 2. 图层、数据与空间对象

| Demo | 关键实现 | 复用建议 |
| --- | --- | --- |
| `tianditu_map` | `WebMapTileServiceImageryProvider` 叠加矢量、影像注记。 | 只借鉴 WMTS 参数结构；密钥、HTTP 地址和服务可用性必须由配置管理。 |
| `layers_split` | `SplitDirection`、`scene.splitPosition`、拖动条事件。 | 可作为卷帘对比基础；需在组件销毁时释放滑块 handler，并处理窗口尺寸变化。 |
| `i3s_object` | I3S 场景对象加载。 | 适合评估 ArcGIS 服务接入；先确认服务鉴权、坐标系和 1.142 API。 |
| `move_3dTiles` | `Cesium3DTileset.fromUrl()`、通过经纬高偏移更新 `modelMatrix`。 | 只借鉴 UI 参数模型。变换必须以原始 `root.transform` 为基线，不能反复累加或 `removeAll()` 清空全场景。 |
| `grounded_billboard` | `HeightReference.CLAMP_TO_GROUND`。 | 可用于地贴广告牌；统一管理图标资源、最小可见距离和碰撞策略。 |
| `flight_tracker` | 时间驱动的移动模型。 | 可迁移 `SampledPositionProperty` / 轨迹表达思路；数据时区与时钟控制应由业务层统一。 |
| `massive_points` | `PointPrimitiveCollection` 绘制约 64,800 个点。 | 是 Entity 与 Primitive 性能分层的有效示例；真实数据需分页、聚合或视域裁剪。 |

### 3. 线、面、城市和业务视觉

| Demo | 关键实现 | 复用建议 |
| --- | --- | --- |
| `border_mask`、`glow_border` | 边界遮罩与发光线。 | 适合行政区聚焦；应采用项目统一的边界 GeoJSON 与样式配置。 |
| `trail_line`、`vertical_trail_line`、`migration_line` | 动态纹理或材质驱动的轨迹线。 | 可提炼为 MaterialProperty 或 CustomShader；控制动画帧率并释放材质引用。 |
| `dynamic_wall`、`dynamic_polyline_volume` | 动态墙体、流动管线。 | 可用于管网和告警表达；参数应由业务含义定义，不直接复用视觉常量。 |
| `ellipsoid_electric`、`radar_scan`、`radar_effect` | 椭球电弧、扫描圈和雷达后处理。 | 更适合作为可开关效果层，避免默认常驻造成帧率下降。 |
| `sky_box`、`skybox_change`、`fog_effect`、`rain_effect`、`snow_effect` | 天空盒与天气环境。 | 作为场景主题能力评估；需要资源预加载、低端设备降级和显式清理。 |
| `dynamic_water` | `EllipsoidSurfaceAppearance` + 内置 `Water` 材质。 | 可借鉴内置材质参数；水面边界和高程应来自业务数据。 |

### 4. 渲染底层、材质与性能

| Demo | 关键实现 | 复用建议 |
| --- | --- | --- |
| `custom_geometry` | 手工创建 `Geometry`、顶点属性和着色器。 | 适合理解 Geometry / Appearance 边界；业务优先使用 Cesium 现成几何体。 |
| `custom_primitive` | 在 `Primitive.update` 中构造 `VertexArray`、`ShaderProgram` 和 `DrawCommand`。 | 仅作底层学习。示例每帧创建 GPU 资源，生产实现必须缓存并在销毁时释放。 |
| `environment_mapping`、`environment_mapping_refraction` | 反射、折射材质。 | 可为高级场景做预研；先验证 WebGL 能力、纹理来源和显存占用。 |
| `optimizing_lots_of_objects` | Three.js 合并 `BufferGeometry`，以顶点色绘制大量方块。 | “批处理替代海量对象”值得复用；在 Cesium 中应选择 Primitive、实例化或 3D Tiles。 |

### 5. Cesium 与 Three.js 同步渲染

| Demo | 关键实现 | 复用建议 |
| --- | --- | --- |
| `cesium_threejs` | 两层 Canvas；停用 Cesium 默认渲染循环；每帧把 Cesium 的 `viewMatrix`、`inverseViewMatrix` 和 `frustum.fovy` 同步给 Three.js 相机。 | 是双引擎融合的核心参考。仅在 Cesium 无法表达的 Three.js 效果有明确价值时采用，并统一一个 `requestAnimationFrame` 循环。 |
| `map_3d` | Three.js 将中国 Mercator 边界挤出为立体地图。 | 适合纯 Three.js 专题页面，不属于 Cesium 数据图层方案。 |

### 6. 纯 Three.js 渲染专题

| Demo | 主题 |
| --- | --- |
| `reflector_example` | 平面倒影与 `Reflector`。 |
| `high_speed_light_trails` | 高速光轨动画。 |
| `custom_surface` | 数据矩阵转曲面。 |
| `rain_cloud` | 云、雨滴和闪电效果。 |
| `fireworks_effect` | 烟花粒子。 |
| `normal_mapping` | 法线贴图。 |
| `physical_material` | PBR 材质基础。 |
| `realistic_material` | HDR 环境与真实材质。 |
| `real_earth` | Three.js 3D 地球。 |

这些页面与当前 Cesium 地图不是同一渲染管线。除非功能明确需要 Three.js 的特定能力，否则优先选择 Cesium 的 Entity、Primitive、Material、CustomShader 或 PostProcessStage。

## 可复用模式

### 绘制工具：以临时图形预览，结束后固化

`draw_line.vue`、`draw_circle.vue` 和 `draw_polygon.vue` 的共同思路是：第一点创建使用 `CallbackProperty` 的临时 Entity；鼠标移动更新最后一个坐标；右键移除临时 Entity 并创建最终图形。这个交互模型正确，但当前项目应补充以下边界：

- 将状态封装为 `idle → drawing → completed / cancelled`，避免多个工具同时注册同一事件。
- 根据 `scene.pickPositionSupported`、深度检测和地形状态选择拾取策略，不只区分椭球与地形。
- 组件卸载时销毁 `ScreenSpaceEventHandler`，并从 `dataSources` 移除专属数据源。
- 坐标输出转换为业务需要的经纬度或 GeoJSON，而不是长期保存 `Cartesian3`。

### 3D Tiles 位置调整：参数可见，变换要可逆

`move_3dTiles.vue` 用滑块暴露经度、纬度和高程偏移，适合做模型校准工具。但是参考实现加载模型时调用 `viewer.scene.primitives.removeAll()`，会误删其他图层；并且直接覆盖 `modelMatrix`，没有保存基线。

当前项目应维护目标 Tileset 引用与原始变换：每次应用参数时先恢复 `root.transform`，再基于原始 `modelMatrix` 组合新的世界变换。这样旋转、连续调参和复位都可预测，也能规避错误的视锥裁剪。

### 双 Canvas 融合：同步投影与视图矩阵

`cesium_threejs.vue` 的关键不是把两个 Canvas 叠起来，而是每帧同步：

1. Cesium 控制地球、相机交互和地理定位；关闭其默认循环，由外层统一调度。
2. Three.js 相机复制 Cesium 的视图矩阵、逆视图矩阵和垂直视场角。
3. Three.js 网格按 WGS84 中心定位，并以地球法线方向校正朝向。

该方式容易出现深度、遮挡、分辨率、鼠标穿透和资源释放问题。正式接入前需定义渲染顺序、帧率预算、窗口 resize 逻辑和 `onBeforeUnmount` 清理清单。

## 不应照抄的实现

| 来源 | 问题 | 当前项目处理方式 |
| --- | --- | --- |
| `src/main.js` | `Ion.defaultAccessToken` 直接写在源码。 | 删除示例 Token；通过环境变量或后端配置注入，并避免向客户端暴露不必要权限。 |
| 多个 `public/*.vue` | `mounted` 创建 Viewer、handler 和动画循环，却没有卸载清理。 | 在 `onBeforeUnmount` 中销毁 Viewer、事件处理器、数据源、后处理阶段与动画任务。 |
| 多个 Viewer 初始化 | 使用 Cesium `1.111.0` 的 `imageryProvider` 选项。 | 在 Cesium `1.142.0` 中使用 `baseLayer` 或 `imageryLayers`；默认全球底图优先 `ImageryLayer.fromWorldImagery()`。 |
| `move_3dTiles.vue` | `removeAll()` 清空场景，且模型变换无基线。 | 只移除目标 Tileset；从原始 transform / matrix 重建变换。 |
| `select_hightlight.vue` | 在已有样式时直接覆写 Tiles Feature 颜色。 | 无样式时才可用；样式激活时优先描边等可恢复效果。 |
| `custom_primitive.vue` | `update()` 中反复创建 VertexArray、ShaderProgram 与 DrawCommand。 | 初始化阶段缓存 GPU 资源，销毁时统一释放；先评估是否可用标准 Primitive 代替。 |
| 多个 Demo | 外部纹理、Tiles、WMTS 和数据 URL 写死。 | 放入配置层，配置超时、失败提示、跨域策略与离线回退。 |

## 建议学习顺序

```text
画廊注册表与路由
  → draw_* 标绘交互
  → tianditu_map / layers_split 图层管理
  → massive_points 性能分层
  → move_3dTiles / select_hightlight 3D Tiles
  → dynamic_* / radar_* 场景视觉
  → custom_geometry / custom_primitive 渲染底层
  → cesium_threejs 双引擎融合（按需）
```

与 [Cesium HTML 示例项目参考指南](./cesium-examples-guide.md) 的分工：前者覆盖更广的 Cesium API、空间分析和材质专题；本文档聚焦 Vue 画廊的组件组织、可操作 Demo 和 Cesium/Three.js 融合实现。
