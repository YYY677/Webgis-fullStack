---
name: srid-4326-convention
description: 项目约定所有空间数据存储为 EPSG:4326，前端显示时转 3857
metadata:
  type: project
---

**约定**：数据库 PostGIS geometry 列全部使用 SRID 4326（WGS 84 经纬度）。

**前端流程**：
- **读**：`st_astext(geom)` 输出 4326 WKT → `readFeature(wkt, {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'})` → OL 自动转为 3857 显示
- **写**：用户绘制时 feature 是 3857 → `transform('EPSG:3857', 'EPSG:4326')` → 存为 4326 WKT
- **后端**：`st_geomfromtext(#{wkt}, 4326)` 强制设 SRID

**例外**：`test_polygon` 和 `layer_edit` 的 SRID 是 0（未定义），属历史数据。

**Why:** 4326 是 OGC/GeoServer 默认标准，便于数据交换；3857 是 Web 地图显示标准，适合 OpenLayers。

**How to apply:** 所有空间表创建、数据导入、WKT 读写都按此流程。