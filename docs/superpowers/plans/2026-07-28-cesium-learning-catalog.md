# Cesium 学习目录实现计划

> **面向 AI 代理的工作者：** 本计划在当前会话内执行；不使用子代理。使用复选框跟踪进度。

**目标：** 以可扩展的专题目录替代 Cesium 的章节侧栏列表，同时保留现有示例页面和 URL。

**架构：** `cesium-learning-catalog.ts` 集中维护专题与章节展示元数据；首页、专题页和侧栏均消费该数据。路由只添加目录入口，不迁移现有章节组件。

**技术栈：** Vue 3 `<script setup>`、TypeScript、Vue Router、Element Plus、Vitest、Vite。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts` | 专题、章节元数据与查询函数 |
| `frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.test.ts` | 专题覆盖、唯一归属、查询行为测试 |
| `frontend/src/pages/cesium-frontend-demo/index.vue` | Cesium 学习首页专题卡片 |
| `frontend/src/pages/cesium-frontend-demo/topic.vue` | 单个专题的章节目录页 |
| `frontend/src/router/index.ts` | 首页与专题页路由，保留既有章节路由 |
| `frontend/src/layout/MainLayout.vue` | Cesium 专题式侧栏渲染 |

### 任务 1：目录元数据与测试

- [x] 新建 `cesium-learning-catalog.test.ts`，断言五个专题覆盖 14 条唯一章节、`getCesiumTopic` 可定位既有章节、未知专题返回 `undefined`。
- [x] 运行 `npm run test -- cesium-learning-catalog.test.ts`，确认因模块不存在而失败。
- [x] 新建 `cesium-learning-catalog.ts`，定义 `CesiumLesson`、`CesiumTopic`、`cesiumTopics`、`getCesiumTopic` 和 `getCesiumTopicByLessonPath`。
- [x] 重新运行目标测试，确认全部通过。

### 任务 2：首页与专题目录

- [x] 新建首页和专题页组件，首页渲染专题数、摘要、代表章节和跳转链接；专题页根据 `topicId` 显示章节卡片，并在未知专题时跳转首页。
- [x] 为首页和专题页添加路由：空子路径对应首页，`topic/:topicId` 对应专题页；移除 Cesium 父路由到第一章的重定向。
- [x] 在浏览器中打开首页、一个专题页和一个既有章节页，确认卡片与返回路径正确。

### 任务 3：Cesium 侧栏收敛

- [x] 让 `MainLayout.vue` 对 Cesium 路由使用目录元数据：渲染学习首页和五个专题入口，其他模块维持原通用菜单逻辑。
- [x] 检查当前示例章节仍可通过菜单进入所属专题，且非 Cesium 菜单项没有变化。

### 任务 4：完整验证

- [x] 运行目标 Vitest 测试与全量 `npm run test`。
- [x] 运行 `npm run build`。
- [x] 启动前端并在浏览器中验证首页、专题页、既有章节 URL 和侧栏导航。
- [x] 查看 `git diff --stat` 和 `git status --short`，仅报告本任务文件，不提交或推送。
