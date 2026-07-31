# Cesium 15-17 底图一致性实现计划

> **面向 AI 代理的工作者：** 在当前会话内按任务顺序实现；每个行为变更先写失败测试，再写最小实现并运行对应测试。不要提交或推送代码。

**目标：** 将 16、17 改为复用 Mars3D 底图模板，并将 15 的可管理基础影像替换为 Mars3D 瓦片。

**架构：** 16、17 调用既有底图注册表的 `activate(viewer)`；15 直接创建 `UrlTemplateImageryProvider`，避免通用注册表清空其余教学影像层。

---

### 任务 1：为 15 的 Mars3D 图层配置建立回归测试

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.test.ts`
- 修改：`frontend/src/pages/cesium-frontend-demo/15-cesium-layer-management.vue`

- [ ] 增加并运行一个失败测试，断言页面导出的 Mars3D 瓦片 URL 与最大层级。
- [ ] 在页面普通模块脚本中导出配置常量，并由 `UrlTemplateImageryProvider` 使用该常量。
- [ ] 运行 `npm.cmd test -- 15-cesium-layer-management.test.ts`，确认通过。

### 任务 2：将 16、17 接入既有 Mars3D 底图模板

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/16-cesium-annotation-edit.vue`
- 修改：`frontend/src/pages/cesium-frontend-demo/17-cesium-performance-lifecycle.vue`

- [ ] 移除两页的 `SingleTileImageryProvider` 初始化，加入既有底图切换控件与当前底图状态。
- [ ] 默认激活 `CESIUM_BASEMAP_LIST` 中的 `mars3d` 项，并为异步失败增加提示与生命周期保护。
- [ ] 保留页面本身的数据源、事件和销毁逻辑；不让底图切换影响其标绘或性能演示对象。

### 任务 3：验证

**文件：**
- 测试：`frontend/src/pages/cesium-frontend-demo/*.test.ts`

- [ ] 运行 `npm.cmd test`。
- [ ] 运行 `npm.cmd run build`。
- [ ] 启动本地 Vite，并在浏览器验证 15 的图层操作及 16、17 的 Mars3D 底图控件无运行时错误。
