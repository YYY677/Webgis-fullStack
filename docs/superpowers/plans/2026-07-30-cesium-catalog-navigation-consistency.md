# Cesium 章节目录与侧栏一致性实现计划

> **目标：** 让 catalog 成为 Cesium 章节标题唯一来源，并为侧栏长标题提供单行截断与完整 Tooltip。

**架构：** 在 catalog 中导出按路径获取章节的函数。路由使用该函数构造 Cesium 子路由的 `meta.title`；布局沿用 catalog 构造菜单，并对菜单文字添加溢出样式和 Tooltip。

---

### 任务 1：固定章节标题的单一来源

**文件：**
- 修改：`frontend/src/pages/cesium-frontend-demo/cesium-learning-catalog.ts`
- 修改：`frontend/src/router/cesium-routes.test.ts`

- [ ] 写一个失败测试：断言每个 Cesium 子路由的 `meta.title` 等于其路径对应的 catalog 标题。
- [ ] 运行 `npm.cmd run test -- cesium-routes.test.ts`，确认测试因当前手写路由标题而失败。
- [ ] 在 catalog 导出按路径获取章节标题的函数；在路由构造章节 `meta.title` 时调用该函数。
- [ ] 再次运行该测试，确认通过。

### 任务 2：保持侧栏长标题可读

**文件：**
- 修改：`frontend/src/layout/MainLayout.vue`
- 修改：`frontend/src/layout/main-layout.test.ts`（若现有测试文件不存在则新建）

- [ ] 写一个失败测试：断言 Cesium 子菜单标题渲染在带 Tooltip 的单行文本元素中。
- [ ] 运行该测试，确认当前菜单缺少 Tooltip 包装而失败。
- [ ] 为 Cesium 菜单项添加完整标题 Tooltip 和省略样式；不修改菜单数据中的标题。
- [ ] 再次运行该测试，确认通过。

### 任务 3：回归验证

**文件：**
- 验证：`frontend/src/router/cesium-routes.test.ts`
- 验证：`frontend/src/layout/main-layout.test.ts`

- [ ] 运行 `npm.cmd run test -- cesium-routes.test.ts main-layout.test.ts cesium-learning-catalog.test.ts`。
- [ ] 运行 `npm.cmd run build`。
- [ ] 在 1440px 宽度浏览器中确认 Cesium 菜单单行显示、长标题 Tooltip 可见、面包屑标题与学习首页一致。
