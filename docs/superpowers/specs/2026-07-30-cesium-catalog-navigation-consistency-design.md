# Cesium 章节目录与侧栏一致性设计

## 目标

使 `cesium-learning-catalog.ts` 成为 Cesium 章节标题的唯一来源，并在不缩短标题、不改变侧栏宽度的前提下解决长菜单项的可读性问题。

## 数据边界

- `cesium-learning-catalog.ts` 维护章节的标题、路径、摘要、API 和缩略图。
- `router/index.ts` 仍只维护路由名称、组件与路径，但子路由 `meta.title` 从 catalog 的对应章节读取。
- 学习首页、Cesium 侧栏和路由面包屑因此使用同一份标题文本。

## 侧栏行为

- 菜单项保持单行，不换行、不改变侧栏宽度、不使用滚动文字。
- 超出宽度的标题以省略号截断。
- 悬停在被截断的章节项上时，Tooltip 展示完整标题；点击行为和当前路由高亮保持不变。

## 验收

- 修改 catalog 中一个章节的 `title` 后，学习首页、Cesium 侧栏与对应路由 `meta.title` 都能读取该值。
- 14 个 Cesium 章节的侧栏项保持单行；长标题可以通过 Tooltip 读到完整内容。
