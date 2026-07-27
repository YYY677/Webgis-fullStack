---
name: geoserver-utf8-body
description: GeoServer REST API 发送中文 SLD 时必须用 byte[] + charset UTF-8
metadata:
  type: reference
---

Spring 的 `StringHttpMessageConverter` 默认使用 ISO-8859-1 编码字符串。直接传 String 给 GeoServer 会导致中文乱码。

**修复**：
```java
// 正确：byte[] body
request.body(xmlBody.getBytes(StandardCharsets.UTF_8));
// MediaType 也要加 charset
MediaType.APPLICATION_XML.withCharset("UTF-8")

// 错误：直接传 String
request.body(xmlBody); // 中文会乱码
```

**Why:** GeoServer REST API 按 Content-Type 的 charset 解码 body，不指定则按 Spring 默认 ISO-8859-1 解析，中文字节被破坏。

**How to apply:** 所有涉及中文的 SLD 创建/更新请求，body 用 `byte[]` + `MediaType;charset=UTF-8`。