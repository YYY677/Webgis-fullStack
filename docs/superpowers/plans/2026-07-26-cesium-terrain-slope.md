# Cesium 地形分析补充实现计划

> **目标：** 修复第 10 章点高程与默认双击交互，并加入可解释、可测试的坡度/坡向分析。

## 文件

- 新建 `frontend/src/utils/terrain-analysis.test.ts`：先定义坡度/坡向计算的预期行为。
- 新建 `frontend/src/utils/terrain-analysis.ts`：实现 Horn 3×3 梯度计算。
- 修改 `frontend/src/pages/cesium-frontend-demo/10-cesium-terrain-analysis.vue`：接入新工具、管理唯一标记并取消默认双击跟踪。

## 步骤

- [ ] 编写并运行失败的 `calculateSlopeAndAspect` 单元测试。
- [ ] 实现最小的纯计算函数，并运行测试确认通过。
- [ ] 在第 10 页增加坡度/坡向按钮、结果和 3×3 地形采样。
- [ ] 高程采样开始时移除旧高程标记；清空分析时清除对应引用。
- [ ] 移除 Viewer 默认的 `LEFT_DOUBLE_CLICK` 输入动作。
- [ ] 运行 `npm test` 与 `npm run build`。
