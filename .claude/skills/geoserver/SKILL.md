---
name: geoserver
description: Use when working with GeoServer REST API — Content-Type traps, anti-corruption layer, SLD DOM+XPath edits, tile cache busting
---

# GeoServer REST API 集成

## 核心陷阱

### Content-Type 决定端点生死

Style 端点对 Content-Type 极敏感，错了报 `No such style handler`：

| Content-Type                  | 用途                                       |
| ----------------------------- | ------------------------------------------ |
| `application/json`            | CRUD workspace/datastore/featuretype/layer |
| `application/vnd.ogc.sld+xml` | 创建/更新样式 SLD 内容                     |
| `application/xml`             | 样式元数据 POST                            |

### SLD 编辑必须用 DOM+XPath

GeoTools 序列化会破坏 XML 结构。用 DOM 解析 + XPath 定位 Rule → `setTextContent` → 其余不动。

关键：`DocumentBuilderFactory` 必须 `setNamespaceAware(true)`，XPath 绑定 `sld` 前缀 → `http://www.opengis.net/sld`。

### ColorMapEntry 用属性而非文本

ColorMapEntry 的 color/quantity/label 是**属性**（`setAttribute`），不是文本节点（`setTextContent`）。不能复用 `setNodeText` 模式，必须单独处理：

```java
Element cmEntry = doc.createElementNS(SLD_NS, "ColorMapEntry");
cmEntry.setAttribute("color", "#AAFFAA");
cmEntry.setAttribute("quantity", "1000");
cmEntry.setAttribute("label", "values");
```

### 中文名须显式 UTF-8

发送 SLD 时 Spring `StringHttpMessageConverter` 默认用 ISO-8859-1 编码，中文变 `?`。MediaType 必须指定 charset：

```java
MediaType.parseMediaType("application/vnd.ogc.sld+xml;charset=UTF-8");
```

### 解析 ColorMap 优先用 `getElementsByTagNameNS`

XPath 在 namespace-aware 模式下对部分 XML 结构不匹配 ColorMapEntry，`getElementsByTagNameNS(SLD_NS, "ColorMapEntry")` 更可靠（回头递归搜索所有子孙节点）。

### Tile 缓存穿透

WMS/WMTS 有 OL 内存 + GWC 双重缓存，加 `_cb: Date.now()` 让每次 tile URL 不同，配合 OL `cacheSize: 0`。

### 响应格式统一

GeoServer 单条返回 Object、多条返回 Array → `normalizeList()` 统一。

---

## SLD 模板设计

### 预设 5 种类型（单选）

替代灵活的 Rule 拼接，提供完整 SLD 模板：

| 类型      | 内容                                                                        |
| --------- | --------------------------------------------------------------------------- |
| `point`   | 单一点 Symbolizer                                                           |
| `line`    | 单一 LineSymbolizer                                                         |
| `polygon` | 单一 PolygonSymbolizer                                                      |
| `raster`  | Opacity + ColorMap（多级颜色分级）                                          |
| `generic` | 混合类型：isCoverage + dimension Filter + ElseFilter + ruleEvaluation:first |

模板用 `STYLENAME` / `STYLEDESC` 占位，创建时 replace。

### Geometry Filter 函数

用 `dimension(geometry())` 按几何维度过滤，比 `geometryType()` 简洁且自动处理 Multi 变体：

```xml
<ogc:Filter>
  <ogc:PropertyIsEqualTo>
    <ogc:Function name="dimension">
      <ogc:Function name="geometry"/>
    </ogc:Function>
    <ogc:Literal>2</ogc:Literal>   <!-- 0=Point, 1=Line, 2=Surface -->
  </ogc:PropertyIsEqualTo>
</ogc:Filter>
```

### ElseFilter + ruleEvaluation

用 `ElseFilter` 兜底 + `VendorOption ruleEvaluation:first` 实现首匹配策略：

```xml
<sld:Rule>
  <sld:Name>point</sld:Name>
  <sld:Title>Blue Point</sld:Title>
  <sld:ElseFilter/>
  <sld:PointSymbolizer>...</sld:PointSymbolizer>
</sld:Rule>
...
<sld:VendorOption name="ruleEvaluation">first</sld:VendorOption>
```

---

## 完整 API 参考（GeoServer REST）

### Workspace

```
GET    /workspaces.json
POST   /workspaces.json                       {"workspace":{"name":"xx"}}
DELETE /workspaces/{name}.json?recurse=true
```

### DataStore

```
GET    /workspaces/{ws}/datastores.json
POST   /workspaces/{ws}/datastores.json
GET    /workspaces/{ws}/datastores/{name}.json
DELETE /workspaces/{ws}/datastores/{name}.json?recurse=true
```

### FeatureType

```
GET    /workspaces/{ws}/datastores/{ds}/featuretypes.json
GET    /workspaces/{ws}/datastores/{ds}/featuretypes.json?list=all
POST   /workspaces/{ws}/datastores/{ds}/featuretypes.json
GET    /workspaces/{ws}/datastores/{ds}/featuretypes/{name}.json
DELETE /workspaces/{ws}/datastores/{ds}/featuretypes/{name}.json?recurse=true
```

### Layer

```
GET    /layers.json
GET    /layers/{name}.json
PUT    /layers/{name}.json                    {"layer":{"defaultStyle":{"name":"xx"}}}
```

### Style

```
GET    /styles.json
GET    /styles/{name}.json
GET    /styles/{name}.sld
POST   /styles?name={name}                    Content-Type: application/vnd.ogc.sld+xml
PUT    /styles/{name}.sld                     Content-Type: application/vnd.ogc.sld+xml
DELETE /styles/{name}?purge=true
```

### Style Rename

两步走：

```
PUT /styles/{oldName}.json      {"style":{"name":"newName"}}     ← GeoServer catalog
GET /styles/{newName}.sld       → DOM 改 NamedLayer/Name, UserStyle/Name, UserStyle/Title
PUT /styles/{newName}.sld       ← 写回更新后的 SLD
```

---

## 常见错误

| 症状                                                 | 原因                            | 修复                               |
| ---------------------------------------------------- | ------------------------------- | ---------------------------------- |
| `"No such style handler: format = application/json"` | 创建样式用了 JSON               | 改成 `application/vnd.ogc.sld+xml` |
| `"No such style handler: format = application/xml"`  | 同样问题                        | 同上                               |
| 中文名变成 `????`                                    | Content-Type 缺 `charset=UTF-8` | MediaType 加 charset               |
| SldParser 返回空列表                                 | `setNamespaceAware(true)` 没设  | 加上                               |
| 表单编辑不显示已有 ColorMap 条目                     | XPath 对 ColorMapEntry 匹配失败 | 改用 `getElementsByTagNameNS`      |
| 图层不刷新                                           | Tile 被浏览器 + GWC 双重缓存    | `_cb` 参数 + `cacheSize:0`         |
