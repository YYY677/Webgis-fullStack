# Cesium 15-17 底图一致性设计

## 目标

让 16、17 复用既有 Mars3D 底图模板；让 15 使用可管理的 Mars3D 影像，同时保持图层树与 Cesium 对象同步。

## 决策

- 16、17 复用 `CesiumBasemapSwitcher`、`CESIUM_BASEMAP_LIST` 与页面内 `switchBasemap` 约定，默认项为 `mars3d`。
- 15 不使用通用底图切换器。该注册表的 `activate(viewer)` 会清空 `viewer.imageryLayers`，会删除页面用于教学的经纬网影像层并使句柄失效。
- 15 的 `base-imagery` 改为 Mars3D `UrlTemplateImageryProvider`，继续作为图层树的普通叶节点，保留显隐、透明度、顺序、移除和恢复。

## 约束

- 不新增工具类；页面短小辅助逻辑保留在页面中。
- 保留并补充关于集合清空风险、底图职责边界的中文注释。
- 使用测试覆盖 Mars3D 图层配置的纯数据约定，并进行构建与浏览器烟测。
