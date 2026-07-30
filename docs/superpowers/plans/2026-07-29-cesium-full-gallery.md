# Cesium 全量章节画廊实现计划

> **面向 AI 代理的工作者：** 本计划在当前会话内执行，不使用子代理。使用复选框跟踪进度。

**目标：** 用 14 张实景封面卡片构成 Cesium 学习首页，恢复完整章节侧栏，并保证全部 Cesium 子路由在主内容区正确渲染。

**架构：** `cesium-learning-catalog.ts` 成为首页卡片和侧栏共有的章节展示元数据；路由使用 `RouterView` 承载 Cesium 子页面；首页只消费章节元数据与静态封面。截图作为 `public` 静态资源，避免运行时截图或网络依赖。

**技术栈：** Vue 3、TypeScript、Vue Router、Vitest、Vite、CesiumJS、本地浏览器自动化。

---

### 任务 1：章节目录元数据与回归测试

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.test.ts`
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts`

- [ ] **步骤 1：编写失败测试**

```ts
expect(cesiumLessons).toHaveLength(14)
expect(cesiumLessons.map((lesson) => lesson.path)).toEqual([
  "/cesium-demo/cesium-entry",
  // 其余既有章节路径，直至 scene-environment
])
expect(cesiumLessons[10]).toMatchObject({
  title: "11-Entity 动态材质",
  thumbnail: "/cesium-data/lesson-thumbnails/11-entity-material.png",
})
```

- [ ] **步骤 2：运行目标测试，确认因缺少 `cesiumLessons` 而失败**

运行：`npm.cmd run test -- cesium-learning-catalog.test.ts`

- [ ] **步骤 3：实现扁平化的 `cesiumLessons` 元数据**

```ts
export const cesiumLessons: CesiumLesson[] = [
  {
    title: "01-Viewer 与场景初始化",
    path: "/cesium-demo/cesium-entry",
    summary: "创建 Viewer，配置场景与基础控件。",
    api: "Viewer · Scene",
    thumbnail: "/cesium-data/lesson-thumbnails/01-viewer-scene.png",
  },
]
```

- [ ] **步骤 4：运行目标测试，确认章节顺序、标题与封面路径通过**

运行：`npm.cmd run test -- cesium-learning-catalog.test.ts`

### 任务 2：路由承载与完整 Cesium 侧栏

**文件：**
- 修改：`frontend/src/router/index.ts`
- 修改：`frontend/src/layout/MainLayout.vue`

- [ ] **步骤 1：为 Cesium 父路由承载组件编写失败测试**

```ts
const cesiumParent = routes[0].children?.find((route) => route.path === "cesium-demo")

expect(cesiumParent?.component).toBe(RouterView)
expect(router.resolve("/cesium-demo/material-effects").name).toBe("CesiumMaterialEffects")
```

- [ ] **步骤 2：运行测试，确认当前父路由未承载子页面而失败**

运行：`npm.cmd run test -- router/cesium-routes.test.ts`

- [ ] **步骤 3：为 Cesium 父路由指定 `RouterView`，并移除专题入口路由**

```ts
import { RouterView, createRouter, createWebHashHistory } from "vue-router"

{
  path: "cesium-demo",
  component: RouterView,
  children: [/* 首页与 14 个既有章节 */],
}
```

- [ ] **步骤 4：侧栏直接映射 `cesiumLessons`，当前章节以 `route.path` 高亮**

```ts
children: [
  { path: "/cesium-demo", title: "学习首页" },
  ...cesiumLessons.map(({ path, title }) => ({ path, title })),
]
```

- [ ] **步骤 5：运行路由与目录测试，确认通过**

运行：`npm.cmd run test -- router/cesium-routes.test.ts cesium-learning-catalog.test.ts`

### 任务 3：全量卡片首页

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/index.vue`

- [ ] **步骤 1：将专题卡片渲染替换为 `cesiumLessons` 的 14 张章节卡片**

```vue
<RouterLink v-for="lesson in cesiumLessons" :key="lesson.path" :to="lesson.path" class="lesson-card">
  <img :src="lesson.thumbnail" :alt="`${lesson.title} 页面快照`" />
  <span>{{ lesson.api }}</span>
  <h2>{{ lesson.title }}</h2>
  <p>{{ lesson.summary }}</p>
</RouterLink>
```

- [ ] **步骤 2：实现三列、两列、单列断点与封面悬停状态**

```scss
.lesson-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 1180px) { .lesson-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 720px) { .lesson-grid { grid-template-columns: 1fr; } }
```

- [ ] **步骤 3：运行目录测试并在浏览器查看三列首页**

运行：`npm.cmd run test -- cesium-learning-catalog.test.ts`

### 任务 4：实景快照

**文件：**
- 创建：`frontend/public/cesium-data/lesson-thumbnails/01-viewer-scene.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/02-coordinates-camera.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/03-screen-events.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/04-entity-graphics.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/05-primitive-geometry.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/06-data-loading.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/07-3dtileset.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/08-clock-entity.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/09-draw-measure.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/10-terrain-analysis.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/11-entity-material.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/12-model-tiles-shader.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/13-primitive-appearance.png`
- 创建：`frontend/public/cesium-data/lesson-thumbnails/14-scene-environment.png`

- [ ] **步骤 1：逐页进入修复后的本地路由，等待核心可视对象加载完成**

固定状态：01 Viewer 场景；02 坐标与相机；03 拾取反馈；04 多种 Entity；05 GeometryInstance；06 已加载 GeoJSON 与模型；07 已加载建筑 tileset；08 可见模型轨迹；09 已完成量算；10 已完成剖面；11 流光线、墙和扩散圆；12 模型与 tiles 同时启用扫描；13 自定义 Appearance 几何；14 天空、雾与场景效果。

- [ ] **步骤 2：以统一桌面视口截取 16:9 画面并保存为对应静态封面**

每张封面以场景画布为主；仅在能说明交互状态时保留小面积控制面板。

- [ ] **步骤 3：在首页逐张检查图片均可加载、比例一致且可识别对应章节**

### 任务 5：完整验证

**文件：**
- 修改：`docs/superpowers/plans/2026-07-29-cesium-full-gallery.md`

- [ ] **步骤 1：运行全部测试**

运行：`npm.cmd run test`

- [ ] **步骤 2：运行生产构建**

运行：`npm.cmd run build`

- [ ] **步骤 3：浏览器验证**

检查 `/cesium-demo` 的三列卡片、14 个封面、完整侧栏，以及首页、01、07、11、12、13、14 章节的直接路由。

- [ ] **步骤 4：查看工作区变更**

运行：`git diff --stat` 与 `git status --short`，仅报告本任务文件，不提交或推送。
