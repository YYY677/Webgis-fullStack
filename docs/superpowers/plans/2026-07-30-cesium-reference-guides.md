# Cesium 参考项目指南整理实现计划

> **面向 AI 代理的工作者：** 本计划用于一次性文档整理；完成每项后以文档结构和路径校验代替代码测试。

**目标：** 将两个外部 Cesium 参考项目转化为适用于本项目 Cesium `1.142.0` 的可检索学习指南。

**架构：** 保留已有 HTML 示例指南的完整主题覆盖，补充版本边界、可迁移性判断和项目经验链接。为 Vue Demo 画廊建立独立指南，按可复用能力而非原目录排列，并明确 Cesium 与 Three.js 的版本差异。

**技术栈：** Markdown、Cesium `1.142.0`、Vue 3、TypeScript。

---

## 任务 1：审查并重构 HTML 示例项目指南

**文件：**
- 修改：`docs/cesium-examples-guide.md`

- [ ] **步骤 1：核对示例源与现有指南覆盖范围**

运行：`rg -n "Cesium 1\.98|imageryProvider|CesiumTerrainProvider|3D Tiles|学习路径" docs/cesium-examples-guide.md`

预期：定位旧版 API、版本说明和学习路径章节，避免删除已有主题入口。

- [ ] **步骤 2：按项目适配性补充文档结构**

在目录总览之前加入“如何使用本指南”与“版本边界”章节；在原有主题目录后加入“项目迁移规则”和“按本项目功能定位的学习路径”。保留原示例文件名，给出 `1.98 → 1.142` 的 API 替代方向。

- [ ] **步骤 3：以项目经验校正旧 API 说明**

将默认底图说明调整为 `ImageryLayer.fromWorldImagery()` / `baseLayer`，将量化网格地形说明调整为 `CesiumTerrainProvider.fromUrl()`；提示 3D Tiles 属性、样式和 `modelMatrix` 必须按本项目经验验证。

- [ ] **步骤 4：验证结果**

运行：`rg -n "^## |Cesium 1\.142|CesiumTerrainProvider\.fromUrl|ImageryLayer\.fromWorldImagery|不应照抄" docs/cesium-examples-guide.md`

预期：输出版本边界、迁移规则和每个关键 API 的正确引用。

## 任务 2：新增 Vue Demo 画廊指南

**文件：**
- 创建：`docs/ceisum-webgis-demo-guide.md`

- [ ] **步骤 1：从注册表生成准确的 Demo 清单**

运行：`Get-Content -Raw 'C:\\Users\\YU\\Desktop\\ceisum示例\\src\\components\\gallery-index.js'`

预期：识别 38 个 `public` Cesium/混合 Demo 与 9 个 `three` Demo，并以注册表而非文件猜测为准。

- [ ] **步骤 2：编写项目定位与版本边界**

说明参考项目使用 Vue `3.2.13`、Vue CLI `5`、Cesium `1.111.0`、Three `0.137.0`，而当前项目使用 Vite、TypeScript、Cesium `1.142.0`；将其定义为实现思路库而非直接复制来源。

- [ ] **步骤 3：按工程能力重组 Demo**

分为绘制交互、图层和数据、3D Tiles、场景视觉、渲染底层、Cesium-Three.js 融合和纯 Three.js 七类；每类提供源文件路径、关键 API、可复用模式和迁移注意事项。

- [ ] **步骤 4：提炼画廊架构与复用边界**

记录 `gallery-index.js` 的注册表 + 动态导入、路由元信息、首页缩略图画廊模式；指出当前项目应以 Vue 3 Composition API、TypeScript、资源释放和统一 Viewer 生命周期替代 Options API 单文件 Demo。

- [ ] **步骤 5：验证结果**

运行：`rg -n "^## |47 个|Cesium `1\.111\.0`|Cesium `1\.142\.0`|gallery-index\.js|不建议直接" docs/ceisum-webgis-demo-guide.md`

预期：文档包含来源、分类、架构模式、迁移规则和明确的复用边界。

## 任务 3：进行文档一致性校验

**文件：**
- 修改：`docs/cesium-examples-guide.md`
- 创建：`docs/ceisum-webgis-demo-guide.md`

- [ ] **步骤 1：检查 Markdown 标题与代码块**

运行：`rg -n "^#|^```" docs/cesium-examples-guide.md docs/ceisum-webgis-demo-guide.md`

预期：两份文档均从一级标题开始，标题级别不跳级，代码围栏成对出现。

- [ ] **步骤 2：检查版本和术语一致性**

运行：`rg -n "Cesium `1\.(98|111|142)\.0`|3D Tiles|Three\.js|Vue 3|Vite" docs/cesium-examples-guide.md docs/ceisum-webgis-demo-guide.md`

预期：示例项目版本和当前项目版本的归属清晰，没有将旧 API 作为当前实现建议。
