# Cesium 全栈章节功能对齐设计

## 目标

将 Cesium 全栈章节的三个页面从最小演示重构为与 OpenLayers 全栈章节功能范围一致的学习页面，同时保留 Cesium 的三维渲染、绘制和坐标处理方式。

明确排除 WFS-T、GeoServer 数据管理和 GeoServer 样式管理。其余已实现的空间数据和空间分析接口全部在 Cesium 页面中使用。

## 页面映射

### 01 GeoServer 服务接入

对应 `ol-fullstack-demo/01-geoserver-load.vue`，提供：

- WMS：加载 `webgistest:shenzhen_roads`。
- WMTS：通过 GeoWebCache 的 `EPSG:900913` 瓦片矩阵加载同一图层。
- WFS：读取 `webgistest:port` GeoJSON，转换为 Cesium Entity，支持点击查看属性。
- 使用 `CesiumBasemapSwitcher`，默认激活 `mars3d`。
- 三种服务均有明确的加载、移除、加载中和错误状态。

WMS 当前故障来自不存在的 `webgistest:road`。GeoServer 实测该请求返回 `application/vnd.ogc.se_xml`，正确图层返回 `image/png`。

### 02 空间要素 CRUD

对应 `ol-fullstack-demo/03-spatial-editor.vue`，页面结构保持同类心智模型：

- 左侧空间表列表：调用 `/api/spatial/tables`，展示全部 9 张已注册空间表，支持搜索和点/线/面标签。
- 中部 Cesium 地图：将数据库 EPSG:4326 WKT 转成 GeoJSON，再由 `GeoJsonDataSource` 渲染。
- 底部属性表：分页、全字段搜索、刷新、添加、属性编辑、重绘几何、删除。
- 编辑弹窗：字段由 `/fields` 接口提供，排除几何列和主键。
- 点、线、面新增均通过 Cesium 屏幕事件绘制；几何修改采用“重新绘制”而不是模仿 OpenLayers 的顶点 Modify。
- 地图拾取与属性表行互相定位。
- 使用 `CesiumBasemapSwitcher`，默认激活 `mars3d`。

页面覆盖 `SpatialDataController` 的 7 个接口：表列表、字段列表、分页查询、搜索、新增、修改、删除。

### 03 服务端空间分析

对应 `ol-fullstack-demo/06-spatial-analysis.vue`，保留相同的标签页与参数组织：

- 缓冲区、相交、合并、差异、对称差、空间关系。
- 距离、面积、长度、中心点。
- pgRouting 最短路径。
- 使用 `CesiumBasemapSwitcher`，默认激活 `mars3d`。

普通 JTS 分析在请求边界把 Cesium 的 WGS84 经纬度投影成 EPSG:3857 WKT，结果再转回 EPSG:4326 渲染。最短路径保持 EPSG:4326 输入输出。

进入路径分析时自动加载 `webgistest:shenzhen_roads` WMS 覆盖层并飞到深圳；离开路径标签时移除路网。

页面覆盖 `SpatialAnalysisController` 的 11 个接口。

## 共用几何转换

新增同目录纯工具文件，集中处理：

- 几何类型归一化为点、线、面。
- 经纬度与 Web Mercator 坐标转换。
- Cesium 绘制顶点生成 EPSG:4326 或 EPSG:3857 WKT。
- WKT 按指定数据投影转为 EPSG:4326 GeoJSON。

该工具同时被 02 和 03 使用，并通过 Vitest 覆盖坐标和几何转换，避免在两个大 SFC 中重复实现高风险逻辑。

## 生命周期与错误处理

- Cesium Viewer、ScreenSpaceEventHandler、DataSource 和业务覆盖层在页面卸载时清理。
- 切换底图后，页面需要恢复仍处于启用状态的 WMS/WMTS 或路径路网覆盖层。
- HTTP、WMS/WMTS Provider 和 WKT 解析失败使用 Element Plus 消息反馈，不让 Cesium 渲染循环因单条异常数据停止。
- 大表仅渲染当前分页，避免一次加载深圳 11 万条道路或 7 万个拓扑节点。

## 验证标准

- 单元测试覆盖几何类型、WKT 和投影转换。
- 前端生产构建通过。
- 真实页面验证三页均位于 WebGIS 内容区内。
- 01 的 WMS、WMTS、WFS 按钮状态可切换，WMS/WMTS 不产生瓦片 Provider 错误。
- 02 展示 9 张表，分页表格可滚动，并完成至少一次表切换和地图渲染。
- 03 展示全部分析标签，路径页可见深圳路网并能选择起终点。
