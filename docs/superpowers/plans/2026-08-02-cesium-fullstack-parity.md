# Cesium 全栈章节功能对齐实现计划

> **面向 AI 代理的工作者：** 在当前工作区按任务顺序执行；项目约定禁止未经用户要求创建 worktree、commit 或 push。

**目标：** 重构 Cesium 全栈三个页面，使其覆盖除 WFS-T、GeoServer 管理和样式管理之外的已有后端与 OGC 服务能力。

**架构：** 01 独立管理 OGC 影像与要素服务；02 复用空间数据 API 构建表—地图—属性工作台；03 复用空间分析 API 构建完整分析工作台。02 和 03 共享纯几何转换工具，Cesium 对象仍由各页面自行管理生命周期。

**技术栈：** Vue 3、TypeScript、CesiumJS 1.142、Element Plus、OpenLayers WKT/GeoJSON 格式工具、Vitest。

---

### 任务 1：共享几何转换工具

**文件：**

- 创建：`frontend/src/pages/cesium-fullstack-demo/cesium-fullstack-geometry.ts`
- 创建：`frontend/src/pages/cesium-fullstack-demo/cesium-fullstack-geometry.test.ts`

- [ ] 编写失败测试：点/线/面类型归一化、4326/3857 WKT 生成、WKT 转 GeoJSON。
- [ ] 运行指定 Vitest，确认因工具未实现而失败。
- [ ] 实现最小转换函数并再次运行测试。

验证命令：

```powershell
npm.cmd test -- src/pages/cesium-fullstack-demo/cesium-fullstack-geometry.test.ts --run
```

### 任务 2：重构 01 GeoServer 服务页

**文件：**

- 修改：`frontend/src/pages/cesium-fullstack-demo/01-geoserver-services.vue`

- [ ] 接入 `CesiumBasemapSwitcher`，Viewer 使用 `baseLayer: false` 并默认激活 `mars3d`。
- [ ] 将 WMS 图层修正为 `webgistest:shenzhen_roads`，监听 Provider 错误。
- [ ] 新增 GeoWebCache WMTS 图层，使用 `EPSG:900913:{z}` 矩阵标签。
- [ ] 将 WFS、WMS、WMTS 加载状态改为响应式，并保持拾取属性展示。
- [ ] 切换底图后恢复仍启用的业务覆盖层。

验证：直接请求 WMS/WMTS 瓦片返回 `image/png`，生产构建无类型错误。

### 任务 3：重构 02 空间 CRUD 页

**文件：**

- 修改：`frontend/src/pages/cesium-fullstack-demo/02-spatial-crud.vue`

- [ ] 按 OL 空间编辑器结构实现空间表列表、地图、底部属性表和编辑弹窗。
- [ ] 删除 POINT 过滤，显示 `/api/spatial/tables` 返回的全部表。
- [ ] 使用分页查询、字段查询和全字段搜索接口。
- [ ] 将当前页 WKT 转换为 GeoJSON DataSource，支持点、线、面和地图拾取。
- [ ] 实现 Cesium 点/线/面绘制，新增和重绘后生成 EPSG:4326 WKT。
- [ ] 实现新增、属性修改、几何修改和删除请求。
- [ ] 接入默认 `mars3d` 底图。

验证：9 张表均显示；选择点、线、面表均能加载；属性表可滚动与分页。

### 任务 4：重构 03 服务端分析页

**文件：**

- 修改：`frontend/src/pages/cesium-fullstack-demo/03-server-analysis.vue`

- [ ] 按 OL 分析页实现 8 个标签与参数面板。
- [ ] 实现 Cesium 点、线、面输入绘制和两个几何槽位。
- [ ] 普通分析提交 EPSG:3857 WKT，结果按 EPSG:3857 转回 4326 渲染。
- [ ] 实现关系结果、数值测量结果和中心点结果展示。
- [ ] 路径页加载深圳路网 WMS，使用 4326 起终点调用 pgRouting。
- [ ] 接入默认 `mars3d` 底图并处理路网覆盖层恢复。

验证：11 个空间分析 API 在页面代码中均有调用；路径页显示路网和起终点状态。

### 任务 5：综合验证

**文件：**

- 检查：上述实现与测试文件。

- [ ] 运行目标单元测试。
- [ ] 运行 `npm.cmd run build`。
- [ ] 运行 `git diff --check`。
- [ ] 使用 Browser 插件验证三条路由、控制台健康、服务切换和主要交互；若 Browser 不可用，明确记录阻塞且不安装新依赖。
