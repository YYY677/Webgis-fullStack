# Cesium 第 07、09、10、11 章设计

## 目标

在既有 8 个 Cesium 前端 API 学习页之后，补充连续的四段学习内容：3D Tiles 性能取舍、交互式绘制量算、地形分析、动态材质。全部数据与计算在浏览器中完成，不接入后端。

## 章节边界

### 第 07 章：3D Tiles 性能补充

只追加一个性能控制卡片，不删改已有加载、样式、拾取和变换内容。卡片提供：

- `maximumScreenSpaceError` 的滑块；
- `skipLevelOfDetail` 与 `dynamicScreenSpaceError` 的开关；
- Cesium 的渲染统计与显存统计调试开关；
- 当前数值与适用边界说明，强调先调 `maximumScreenSpaceError`，其余两个仅用于理解和特定数据集的实验。

### 第 09 章：绘制与量算

通过 `ScreenSpaceEventHandler` 实现点、线、面的左键加点、鼠标移动预览、右键完成。使用 `CallbackProperty` 保持预览几何实时更新。完成后显示经纬度、折线地表距离或局部投影近似面积，并保留结果列表与清空入口。

### 第 10 章：地形与剖面

使用已有 Mars3D 地形：点击采样一点高程；绘制两点或多点线后使用 `sampleTerrainMostDetailed` 获取剖面；以地形采样点与两端直线高度比较，给出简单通视结论。页面明确提示采样是异步网络请求，结果质量受地形数据分辨率影响。

### 第 11 章：动态材质

通过可复用的 `MaterialProperty` 类注册 Fabric 自定义流动材质，并分别应用于 Polyline 与 Wall。使用 `CallbackProperty` 驱动扩散圆半径和透明度。页面显示暂停/恢复和参数控制，重点区分：`Material` 定义 GPU 材质，`MaterialProperty` 按时间向 Entity 提供材质 uniform。

## 结构与生命周期

- 新页面沿用现有 `Viewer`、底图切换器、左侧 `el-card` 的页面结构。
- 每页只维护一个 `Viewer` 和一个交互 handler；`onUnmounted` 中销毁 handler、实体和 viewer。
- 共用的量算计算提取到 `src/utils/cesium-measure.ts`，使地表距离、局部面积与格式化可独立测试。
- 路由按 09、10、11 顺序追加在第 08 章后。

## 非目标

- 不实现裁剪、剖切、后端空间分析或持久化；
- 不将性能选项包装成“普适优化方案”；
- 不删除或重写第 07 章已有教学内容。
