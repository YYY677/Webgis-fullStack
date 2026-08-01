# 学习目录统一实现计划

> **面向 AI 代理的工作者：** 使用当前会话逐项实施，并在最终构建前检查目录、路由和首页渲染的一致性。

**目标：** 为四个学习主题建立一致的章节元数据来源，让首页、路由标题和侧栏菜单不再重复维护，并为每个章节提供可替换的截图占位路径。

**架构：** 每个主题目录保留一个 `learning-catalog.ts`，包含路径、标题、摘要、缩略图和路由组件加载函数。`router/index.ts` 将 catalog 转换为子路由，首页通过 `v-for` 直接渲染 catalog，`MainLayout.vue` 只读取路由记录生成菜单。

**技术栈：** Vue 3、Vue Router、Vite 动态导入函数、TypeScript。

---

### 任务 1：统一四份章节目录

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts`
- 修改：`frontend/src/pages/cesium-fullstack-demo/cesium-fullstack-learning-catalog.ts`
- 创建：`frontend/src/pages/ol-frontend-demo/ol-learning-catalog.ts`
- 创建：`frontend/src/pages/ol-fullstack-demo/ol-learning-catalog.ts`

- [x] 为每条章节记录增加一致的 `thumbnail` 与 `component` 字段。
- [x] 将缩略图默认指向各主题公共目录中的 `placeholder.svg`。

### 任务 2：从目录生成首页和路由

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/index.vue`
- 修改：`frontend/src/pages/cesium-fullstack-demo/index.vue`
- 修改：`frontend/src/pages/ol-frontend-demo/index.vue`
- 修改：`frontend/src/pages/ol-fullstack-demo/index.vue`
- 修改：`frontend/src/router/index.ts`
- 修改：`frontend/src/layout/MainLayout.vue`

- [x] 首页统一通过 `v-for` 渲染截图、标题、摘要和入口。
- [x] 路由保留父级与首页记录，章节子路由由 catalog 映射产生。
- [x] 删除侧栏对 Cesium 的特殊分支，使用通用子路由菜单。

### 任务 3：补齐截图占位资源并验证

**文件：**
- 创建：`frontend/public/ol-data/lesson-thumbnails/placeholder.svg`
- 创建：`frontend/public/cesium-fullstack-data/lesson-thumbnails/placeholder.svg`

- [x] 每个非 Cesium 前端章节都拥有具体可替换的 `thumbnail` 路径。
- [x] 运行 `npm.cmd run build`，确认 TypeScript、路由动态导入和 Vite 打包通过。
