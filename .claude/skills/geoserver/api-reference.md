# GeoServer REST API 参考

Base URL: `{url}/rest`（如 `http://localhost:8081/geoserver/rest`），Basic Auth，JSON 格式。

## Workspace

```
GET    /workspaces.json
POST   /workspaces.json                       {"workspace":{"name":"xx"}}
DELETE /workspaces/{name}.json?recurse=true
```

## DataStore

```
GET    /workspaces/{ws}/datastores.json
POST   /workspaces/{ws}/datastores.json       数据存储配置（PostGIS 连接参数）
GET    /workspaces/{ws}/datastores/{name}.json
DELETE /workspaces/{ws}/datastores/{name}.json?recurse=true
```

## FeatureType

```
GET    /workspaces/{ws}/datastores/{ds}/featuretypes.json          已发布的
GET    /workspaces/{ws}/datastores/{ds}/featuretypes.json?list=all 全部表名
POST   /workspaces/{ws}/datastores/{ds}/featuretypes.json          发布
GET    /workspaces/{ws}/datastores/{ds}/featuretypes/{name}.json   详情
DELETE /workspaces/{ws}/datastores/{ds}/featuretypes/{name}.json?recurse=true  取消发布
```

## Layer

```
GET    /layers.json
GET    /layers/{name}.json
PUT    /layers/{name}.json                    {"layer":{"defaultStyle":{"name":"xx"}}}
```

## Style

创建使用 `application/vnd.ogc.sld+xml`，CRUD 使用 `application/json`。

```
GET    /styles.json                           列表
GET    /styles/{name}.json                    元数据
GET    /styles/{name}.sld                     获取 SLD XML
POST   /styles?name={name}                    Content-Type: application/vnd.ogc.sld+xml
PUT    /styles/{name}.sld                     Content-Type: application/vnd.ogc.sld+xml
DELETE /styles/{name}?purge=true              删除
```

重命名（只改 catalog 注册名，SLD 内部 Name/Title 没必要同步）：
```
PUT /styles/{oldName}.json      {"style":{"name":"newName"}}
```

## 响应格式

GeoServer 单条返回 Object、多条返回 Array，统一用 `normalizeList()`。
