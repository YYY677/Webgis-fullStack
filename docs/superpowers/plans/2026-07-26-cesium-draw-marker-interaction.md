# Cesium 绘制标记与完成交互实现计划

> **面向执行者：** 在当前工作区完成本计划；不要覆盖现有未提交改动，也不要自动提交或推送。

**目标：** 为第 09 章的点、顶点添加贴地可见的显示偏移，并支持双击完成绘制。

**架构：** 原始拾取坐标继续服务于量算与贴地线面；仅标记使用由 Cartographic 高程加 2 m 得到的显示坐标。双击处理复用既有完成函数，并在完成前清除连续重复的末点。

**技术栈：** Vue 3、TypeScript、CesiumJS、Vitest。

---

### 任务 1：更新第 09 章绘制交互

**文件：**

- 修改：`frontend/src/pages/cesium-frontend-demo/09-cesium-draw-measure.vue`

- [ ] 增加地形优先的拾取降级逻辑：`scene.pickPosition` 失败后使用 `scene.globe.pick(camera.getPickRay(...), scene)`，最后才使用 `camera.pickEllipsoid`。
- [ ] 增加由 `Cartographic` 创建显示坐标的辅助函数，将标记提高 2 m；量算数组仍保存原始坐标。
- [ ] 为点位和顶点 Entity 使用显示坐标，并在注释中说明为什么不改写量算坐标。
- [ ] 注册 `LEFT_DOUBLE_CLICK`；在默认 Viewer 事件处理器中移除双击缩放。
- [ ] 在完成前清除连续重复的末点及其顶点 Entity，保留右键完成。
- [ ] 更新面板操作提示，并补充拾取、预览、完成与生命周期的中文学习注释。

### 任务 2：验证

**文件：**

- 测试：`frontend/src/utils/cesium-measure.test.ts`

- [ ] 运行 `npm test -- cesium-measure.test.ts`，确认现有距离、面积、格式化计算仍通过。
- [ ] 运行 `npm run build`，确认 Vue 与 Cesium 类型、生产构建通过。
- [ ] 本地打开第 09 章，验证点和顶点完整显示，右键和双击均能完成绘制。
