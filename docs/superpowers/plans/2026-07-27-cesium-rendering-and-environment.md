# Cesium 渲染进阶与场景环境示例实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 新增 12·CustomShader、13·自定义 Appearance、14·场景环境与出图三个可交互 Cesium 前端学习页面，并补齐本地演示资源。

**架构：** 三页各自维护 Viewer 生命周期，复用现有底图切换器。纯资源路径与六面天空盒映射提取为 `cesium-rendering.ts` 并通过 Vitest 覆盖；各页只负责编排 Viewer、Cesium 对象与 Element Plus 面板交互。

**技术栈：** Vue 3 `<script setup>`、TypeScript strict、Cesium 1.142、Element Plus、Vitest、Vite。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `frontend/src/utils/cesium-rendering.ts` | 天空盒资源映射、场景模式标签和截图文件名等纯函数。 |
| `frontend/src/utils/cesium-rendering.test.ts` | 纯函数的行为测试。 |
| `frontend/src/pages/cesium-frontend-demo/12-cesium-custom-shader.vue` | Model / 3D Tiles CustomShader 学习页。 |
| `frontend/src/pages/cesium-frontend-demo/13-cesium-custom-appearance.vue` | Primitive Appearance 学习页。 |
| `frontend/src/pages/cesium-frontend-demo/14-cesium-scene-environment.vue` | SkyBox、场景模式、雾效与 PNG 导出页。 |
| `frontend/src/router/index.ts` | 三个子路由。 |
| `frontend/public/cesium-data/` 下新增资源 | 本地天空贴图、Shader 纹理与轻量模型。 |

### 任务 1：资源清单与纯函数

**文件：**
- 创建：`frontend/src/utils/cesium-rendering.test.ts`
- 创建：`frontend/src/utils/cesium-rendering.ts`
- 创建：`frontend/public/cesium-data/skybox/`
- 创建：`frontend/public/cesium-data/shader-textures/`
- 创建：`frontend/public/cesium-data/models/737/`、`7372/`、`dd/`、`dk/`、`uav/`

- [x] **步骤 1：编写失败的工具测试**

```ts
import { describe, expect, it } from "vitest"
import { createSkyBoxSources, formatSceneExportName, getSceneModeLabel } from "./cesium-rendering"

describe("Cesium rendering helpers", () => {
  it("maps all six skybox faces under the public asset root", () => {
    expect(createSkyBoxSources("/cesium-data/skybox")).toEqual({
      positiveX: "/cesium-data/skybox/tycho2t3_80_px.jpg",
      negativeX: "/cesium-data/skybox/tycho2t3_80_mx.jpg",
      positiveY: "/cesium-data/skybox/tycho2t3_80_py.jpg",
      negativeY: "/cesium-data/skybox/tycho2t3_80_my.jpg",
      positiveZ: "/cesium-data/skybox/tycho2t3_80_pz.jpg",
      negativeZ: "/cesium-data/skybox/tycho2t3_80_mz.jpg",
    })
  })

  it("creates a stable PNG filename and readable scene labels", () => {
    expect(formatSceneExportName(new Date("2026-07-27T08:09:10Z"))).toBe("cesium-scene-20260727-080910.png")
    expect(getSceneModeLabel("SCENE3D")).toBe("3D 地球")
  })
})
```

- [x] **步骤 2：运行测试并确认失败**

运行：`npm run test -- cesium-rendering.test.ts`

预期：FAIL，报错无法解析 `./cesium-rendering`。

- [x] **步骤 3：实现最小工具函数**

```ts
export function createSkyBoxSources(base = "/cesium-data/skybox") {
  return {
    positiveX: `${base}/tycho2t3_80_px.jpg`, negativeX: `${base}/tycho2t3_80_mx.jpg`,
    positiveY: `${base}/tycho2t3_80_py.jpg`, negativeY: `${base}/tycho2t3_80_my.jpg`,
    positiveZ: `${base}/tycho2t3_80_pz.jpg`, negativeZ: `${base}/tycho2t3_80_mz.jpg`,
  }
}
```

实现 `formatSceneExportName()` 和 `getSceneModeLabel()`，让断言全部通过；复制规格列出的资源，且保持 glTF 相对纹理路径不变。

- [x] **步骤 4：运行测试确认通过**

运行：`npm run test -- cesium-rendering.test.ts`

预期：PASS，2 个测试通过。

### 任务 2：12 · CustomShader

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/12-cesium-custom-shader.vue`
- 修改：`frontend/src/router/index.ts`

- [x] **步骤 1：实现页面与路由**

实现 `CustomShader` 页面，使用 `Model.fromGltfAsync` 加载 `/cesium-data/models/737/scene.gltf`，使用本地 `tiles-buildings` 加载 Tileset。定义 `heightGradient` 和 `scan` 两种 `CustomShader` 工厂；统一通过 `setUniform("u_color", color)`、`setUniform("u_scanWidth", width)` 更新参数。路由配置为：

```ts
{ path: "custom-shader", name: "CesiumCustomShader", component: () => import("@/pages/cesium-frontend-demo/12-cesium-custom-shader.vue"), meta: { title: "12-CustomShader" } }
```

- [x] **步骤 2：运行工具测试与页面类型检查**

运行：`npm run test -- cesium-rendering.test.ts`，然后 `npm run build`。

预期：测试通过，构建无 TypeScript 错误。

### 任务 3：13 · 自定义 Appearance

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/13-cesium-custom-appearance.vue`
- 修改：`frontend/src/router/index.ts`

- [x] **步骤 1：实现 Appearance 页面与路由**

创建两个 `Primitive`。第一个以 `Appearance` 的 `vertexShaderSource` / `fragmentShaderSource` 实现高度渐变；第二个使用 `czm_frameNumber` 实现循环扫描。面板以布尔开关重建或更新 `renderState` 的 `depthTest.enabled`、`blending`、`cull.enabled`。添加：

```ts
{ path: "custom-appearance", name: "CesiumCustomAppearance", component: () => import("@/pages/cesium-frontend-demo/13-cesium-custom-appearance.vue"), meta: { title: "13-自定义 Appearance" } }
```

- [x] **步骤 2：运行工具测试与构建**

运行：`npm run test -- cesium-rendering.test.ts`，然后 `npm run build`。

预期：测试通过；构建通过。

### 任务 4：14 · 场景环境与出图

**文件：**
- 创建：`frontend/src/pages/cesium-frontend-demo/14-cesium-scene-environment.vue`
- 修改：`frontend/src/router/index.ts`

- [x] **步骤 1：实现环境页面与路由**

使用 `createSkyBoxSources()` 生成 `SkyBox` 的 `sources`；实现默认 / 自定义 / 关闭天空盒、`SCENE2D` / `COLUMBUS_VIEW` / `SCENE3D` 模式切换、天空大气与基础雾效开关、背景色选择及 canvas PNG 下载。Viewer 初始化传入 `contextOptions.webgl.preserveDrawingBuffer: true`，导出前调用 `scene.render()`。

添加：

```ts
{ path: "scene-environment", name: "CesiumSceneEnvironment", component: () => import("@/pages/cesium-frontend-demo/14-cesium-scene-environment.vue"), meta: { title: "14-场景环境与出图" } }
```

- [x] **步骤 2：运行工具测试与生产构建**

运行：`npm run test -- cesium-rendering.test.ts`，然后 `npm run build`。

预期：测试通过；构建通过。

### 任务 5：真实页面验证与收尾

**文件：**
- 修改：必要时仅修复前述页面。

- [x] **步骤 1：启动前端并逐页验证**

运行：`npm run dev -- --host 127.0.0.1`。

逐页打开三个新增路由，确认模型 / Tileset Shader、Appearance 渐变与扫描、SkyBox / 模式 / PNG 导出均有可见结果；检查浏览器控制台没有 shader 编译错误。

- [x] **步骤 2：运行完整验证**

运行：`npm run test && npm run build`

预期：所有测试通过，生产构建成功。

- [x] **步骤 3：展示变更摘要**

运行：`git diff --stat` 和 `git status --short`，向用户展示新增页面、路由、工具、测试和资源的文件级摘要；不自动提交或推送。
