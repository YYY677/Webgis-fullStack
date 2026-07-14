---
name: geoserver
description: Use when working with GeoServer REST API — Content-Type traps, anti-corruption layer, SLD DOM+XPath edits, tile cache busting
---

# GeoServer REST API 集成

## 核心陷阱

**Content-Type**：Style 端点极敏感，错了报 `No such style handler`。`application/json` 用于 CRUD，`application/vnd.ogc.sld+xml` 用于 SLD 创建更新。

**UTF-8 中文**：Spring `StringHttpMessageConverter` 默认 ISO-8859-1，MediaType 必须加 `;charset=UTF-8`。Body 用 `xmlBody.getBytes(UTF_8)` 发 byte[] 而非 String。

**Tile 缓存**：OL 内存 + GWC 双重缓存，`_cb: Date.now()` + `cacheSize: 0` 穿透。

**响应格式**：单条 Object 多条 Array → `normalizeList()` 统一。

## 详细文档

- [SLD 编辑设计模式](sld-patterns.md) — DOM+XPath 架构、手动遍历模式、GeoServer 序列化陷阱、空值处理、ColorMap
- [API 参考](api-reference.md) — 完整 REST 端点列表
