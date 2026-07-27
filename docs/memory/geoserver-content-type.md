---
name: geoserver-content-type
description: GeoServer Style 端点对 Content-Type 极其敏感，错了报 No such style handler
metadata:
  type: reference
---

GeoServer REST API 的 `/rest/styles` 端点通过 Content-Type 判断请求体格式，设置错误会返回 `No such style handler`。

| 操作 | Content-Type |
|------|-------------|
| CRUD（列表/详情/删除） | `application/json` |
| SLD 创建/更新 | `application/vnd.ogc.sld+xml` |

**常见错误**：SLD 更新用了 `application/xml` → GeoServer 不认识，报 handler 不存在。

**Why:** GeoServer 内部根据 Content-Type 路由到不同的解析器（StyleHandler），JSON 和 XML/SLD 走不同的处理器。

**How to apply:** 创建/更新 SLD body 时固定用 `application/vnd.ogc.sld+xml;charset=UTF-8`。