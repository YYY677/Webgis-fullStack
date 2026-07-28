# Cesium 渲染进阶与场景环境示例设计

## 目标

在既有 01～11 Cesium 前端示例基础上新增三个独立页面，分别学习模型 / 3D Tiles 着色、普通 Primitive 的 Appearance 渲染入口，以及场景环境控制。页面继续使用 Vue 3 Composition API、Cesium 1.142、现有底图切换器和本地静态数据；不接入后端服务，不引入第三方依赖。

## 页面与路由

| 序号 | 文件 | 路由 | 标题 |
| --- | --- | --- | --- |
| 12 | `12-cesium-custom-shader.vue` | `custom-shader` | `12-CustomShader` |
| 13 | `13-cesium-custom-appearance.vue` | `custom-appearance` | `13-自定义 Appearance` |
| 14 | `14-cesium-scene-environment.vue` | `scene-environment` | `14-场景环境与出图` |

三个路由均加入既有 Cesium 前端示例父路由，自动出现在侧边栏菜单；不改动 01～11 页面。

## 12 · CustomShader

### 学习目标

明确 `CustomShader` 是 Model 与 `Cesium3DTileset` 的 GPU 着色入口，不适用于普通 `Primitive`；理解 `uniform`、`varying`、`vertexMain`、`fragmentMain`，以及 `MODIFY_MATERIAL` 与 `REPLACE_MATERIAL` 的边界。

### 场景与交互

- 加载本地 glTF / GLB 模型与 `tiles-buildings` Tileset，各自保留独立的加载、移除与相机定位操作。
- 模型与 Tileset 共用三种可切换效果：关闭、自下而上的高度渐变、按时间循环的扫描高亮。
- 面板提供主色、扫描带宽度与动画开关；参数通过 `CustomShader.setUniform()` 更新，不重建场景对象。
- 提供模式说明卡片，解释“保留原模型材质后修改”与“替换材质阶段”的区别；演示默认仅使用 `MODIFY_MATERIAL`，避免掩盖原始纹理。

### 非目标

- 不依赖 feature 属性，因此不重复 `Cesium3DTileStyle` 的属性筛选与条件着色。
- 不包含后处理、裁剪、模型编辑或 DrawCommand。

## 13 · 自定义 Appearance

### 学习目标

在第 05 页已有 `PerInstanceColorAppearance` 与 `MaterialAppearance` 的基础上，进入普通 Primitive 的渲染入口：Geometry 顶点属性、`vertexFormat`、顶点 / 片元 Shader 和 `RenderState`。

### 场景与交互

- 创建两组独立 Primitive：一组用于静态高度渐变，一组用于动态扫描；均使用 `new Appearance({ vertexShaderSource, fragmentShaderSource, renderState })`。
- 顶点 Shader 负责位置变换与所需 varying 传递；片元 Shader 负责渐变与扫描颜色计算。动态扫描使用 Cesium 内置 `czm_frameNumber`，不引入 DrawCommand 才需要的自定义 uniform map。
- 面板切换深度测试、透明混合与背面剔除，直观观察 `RenderState` 对渲染结果的影响。
- 明确展示各个 Geometry 所需的 `vertexFormat`，并说明与第 11 页 Fabric Material 的区别：Fabric 由 `Material` 组合 shader，Appearance 直接定义 Primitive 的 shader 源码。

### 非目标

- 不实现顶点缓冲、索引缓冲、ShaderProgram 或多 Pass；这些属于 DrawCommand 学习范围。
- 不复刻第 05 页的性能对比和内置材质示例。

## 14 · 场景环境与出图

### 学习目标

掌握不涉及业务数据的常用场景级 API：天空盒、场景模式、背景 / 雾效配置和画布截图；明确普通 SkyBox 与近地天空盒的难度边界。

### 场景与交互

- 提供默认天空盒、Cesium 内置六面天空贴图和关闭天空盒三种状态。六张贴图复用 Cesium 安装包 `Assets/Textures/SkyBox` 中的资源，不下载外部资源。
- 切换 `SCENE2D`、`COLUMBUS_VIEW`、`SCENE3D`，显示当前模式与相应限制；天空盒仅在 3D 模式作为重点观察。
- 控制天空大气、背景色和基础雾效；不把高度雾、体积云或局部天气混入本页。
- 将当前 Cesium canvas 导出为 PNG，并在导出前确保同一帧已渲染完成。
- 说明近地天空盒需要额外实现或辅助类，暂不直接移植参考项目的 `skyBoxOnGround.js`。

### 非目标

- 雨雪、火焰等 `ParticleSystem` 专题；它们后续单独学习。
- WebGL2 高度雾、体积云、闪电等高阶 shader / 后处理特效。

## 共同约束

- 每页沿用 `CesiumBasemapSwitcher`、`CESIUM_BASEMAP_LIST` 和现有 Viewer 的销毁模式。
- Cesium 对象不放入深度 Vue 响应式；组件卸载时移除事件监听并调用 `viewer.destroy()`。
- 使用 `requestRenderMode: false`，保证动画示例持续刷新；动画关闭时通过控制页面状态或 Scene 设置停止视觉变化。
- 新增纯函数和可复现渲染参数转换时编写 Vitest；CSS、面板布局等低风险展示变更以生产构建和真实页面验证为准。

## 参考资源纳入策略

参考项目位于 `C:\Users\YU\Desktop\Cesium-Examples-main\examples\cesiumEx`。保留当前工程已复制的 3D Tiles（`tiles-buildings`、`tiles-oblique`）及大型通用模型；新增资源仅复制本次页面会使用或可在后续基础模型示例中复用、且总体积可控的文件。

| 目标目录 | 来源 | 用途 |
| --- | --- | --- |
| `frontend/public/cesium-data/skybox/` | `SkyBox/` 全部图片 | 第 14 页的普通天空盒、近地天空盒资源对比、背景图与后续水面 / 烟雾专题。 |
| `frontend/public/cesium-data/shader-textures/` | `wall.jpg`、`wall1.jpg` | 后续 `TextureUniform` 章节可复用的本地外墙纹理；本次三页暂不采样。 |
| `frontend/public/cesium-data/models/737/` | `models/737/` | 小型客机 glTF，用于模型 Shader 示例。 |
| `frontend/public/cesium-data/models/7372/` | `models/7372/` | 带纹理的大型客机，用于观察 CustomShader 保留原材质的结果。 |
| `frontend/public/cesium-data/models/dd/`、`dk/`、`uav/` | 对应 `models/` 子目录 | 轻量、可复用的物体 / 地形 / 无人机模型。 |

不复制 `models/bz1`、`models/bz2`、`models/wall` 和 `road`：它们合计超过 140 MiB，当前三页不依赖，且应在有明确场景时按需引入。每个新资源目录保留来源项目中的 `license.txt`；若来源没有许可证文件，则在资源清单中注明参考来源与用途。

## 验收标准

1. 三个新路由均可从侧边栏进入，并能独立创建、销毁 Viewer。
2. 第 12 页能在本地模型和 Tileset 上切换渐变、扫描及关闭状态，运行时不产生 Cesium shader 错误。
3. 第 13 页能观察到自定义 Appearance 的静态与动态渲染结果，三项 RenderState 开关对结果产生可解释变化。
4. 第 14 页可切换天空盒和三种场景模式，基础雾效可见，截图可导出 PNG。
5. `npm run test` 与 `npm run build` 均通过。
