# 文件上传两个 Bug 修复

## Bug 1: 上传超时

**原因：** axios 默认超时 10s（request.ts:9）。2MB 的 Shapefile 需要解压→GeoTools 解析→JDBC 建表→500 条 batch insert，10s 不够。

**修复：** 
- 前端 `uploadFeatureTypeFile` 单独设 `timeout: 60000`（60s）
- Spring Boot 文件上传最大 50MB 已够，不用改

## Bug 2: GeoJSON "未定义坐标系"

**原因：** GeoJSON 规范中 WGS84(EPSG:4326) 是默认值，大多数 GeoJSON 文件不写 `crs` 字段。但 `checkCRS()` 检测到 `schema.getCoordinateReferenceSystem() == null` 时直接拒绝。

**修复：** 
- 当 `crs == null` 时视为 EPSG:4326 通过校验
- 如果是 Shapefile `.prj` 缺失（也导致 null），默认当作 4326 处理

## 额外优化: 支持多文件 Shapefile

用户要求支持"直接拉取多文件"（不打包 zip）。

**前端：** 文件 input 加 `multiple` 属性，允许同时选 .shp/.shx/.dbf/.prj

**后端：** upload 端点接受 `@RequestParam("files") MultipartFile[]`，存到临时目录后用 ShapefileDataStore 读取

## 改动文件

| 文件 | 改动 |
|------|------|
| `api/geoserver.ts` | uploadFeatureTypeFile 加 timeout: 60000 |
| `03-geoserver-rest.vue` | 文件 input 加 multiple，支持多文件；区分 zip/多文件两种模式 |
| `DataUploadService.java` | CRS 校验放宽(null 视为 4326)；支持 MultipartFile[] 多文件接收 |
| `GeoServerController.java` | upload 端点接受 MultipartFile[] |

## 验证

1. 上传 2MB Shapefile zip → 不超时，成功
2. 同时拖选 .shp + .shx + .dbf → 成功
3. 上传无 crs 声明的 GeoJSON → 视为 4326 通过
4. 上传非 4326 数据 → 拒绝（保留校验）
