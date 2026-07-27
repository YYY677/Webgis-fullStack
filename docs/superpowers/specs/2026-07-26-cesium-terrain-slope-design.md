# Cesium 地形分析补充设计

## 目标

完善第 10 章地形分析页面：点高程只保留最新标记，取消 Viewer 默认双击跟踪，并增加坡度/坡向分析。

## 交互

- 点高程：每次点击开始新采样时移除上一枚红色高程标记；结果仅显示最新一次。
- 双击：移除 `Viewer` 内置的 `LEFT_DOUBLE_CLICK` 动作。该动作会将被拾取实体设为 `trackedEntity`，导致相机进入跟踪状态。本页不为双击注册替代动作。
- 坡度/坡向：点击一个地表位置后，以中心点周围 30 m 的 3×3 网格调用 `sampleTerrainMostDetailed`。结果展示坡度角与最大下坡方向；在地图中显示一个紫色中心标记。

## 计算边界

- 坡度和坡向使用 Horn 3×3 邻域梯度法。
- 高程网格按 `[NW, N, NE, W, C, E, SW, S, SE]` 排列，`cellSize` 是相邻样本的米制间隔。
- 坡度为地表相对水平面的倾角；坡向为最大下坡方向，北为 0°、东为 90°。完全平坦时坡向为 `null`。
- 这是基于地形服务分辨率和 30 m 邻域的局部估算，不是测绘级成果。

## 文件边界

- `frontend/src/utils/terrain-analysis.ts`：不依赖 Cesium 或 Vue 的纯数学计算，可单元测试。
- `frontend/src/utils/terrain-analysis.test.ts`：验证平地、向东上升和向北上升的坡度/坡向。
- `frontend/src/pages/cesium-frontend-demo/10-cesium-terrain-analysis.vue`：构造采样网格、请求地形、保存结果并渲染交互实体。
