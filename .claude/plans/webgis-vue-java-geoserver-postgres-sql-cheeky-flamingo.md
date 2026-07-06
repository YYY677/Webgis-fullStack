# 后端 GeoServer 模块重构

## Context

已实现的 `geoserver/` 模块存在 4 个问题需要整改：

### 问题 1: DTO 字段多余

GeoServer REST API **所有 summary 端点**（列表）只返回 `name` + `href`：

```json
// /workspaces.json → {"workspaces":{"workspace":[{"name":"webgis","href":"..."}]}}
// /workspaces/{ws}/datastores.json → {"dataStores":{"dataStore":[{"name":"pg-webgistest","href":"..."}]}}
// /workspaces/{ws}/datastores/{ds}/featuretypes.json → {"featureTypes":{"featureType":[{"name":"capital","href":"..."}]}}
// /layers.json → {"layers":{"layer":[{"name":"webgistest:port","href":"..."}]}}
```

但当前 DTO 定义了不存在的字段：
- `DataStoreInfo.type` → null
- `FeatureTypeInfo.title`, `FeatureTypeInfo.nativeName` → null
- `LayerInfo.title`, `LayerInfo.type`, `LayerInfo.defaultStyle` → null

**整改：** 所有 DTO 只保留 `name` + `href`，删掉多余的。对应的前端 `geoserver.ts` 接口类型也同步简化。

### 问题 2: WebClient → RestClient

项目是 Spring MVC (Tomcat)，不是 WebFlux (Netty)。WebClient 的 `Mono`/`Flux` 在 MVC 下底层同步阻塞，白增加复杂度。

Spring Boot 3.2+ 内置 `RestClient`：
- 同步 API（不需要 Mono/Flux）
- 同样支持 Builder 模式、error handler
- 跟 MVC 体系一致

**整改：** `GeoServerClient` 改用 `RestClient`；4 个 Service 去掉 `Mono<>`；Controller 返回 `Result<T>` 而非 `Mono<Result<T>>`。

### 问题 3: Controller 改为 `web/` 包名

项目规范：`auth/web/AuthController.java`、`system/web/UserController.java`。当前 `geoserver/controller/GeoServerController.java` 不符合命名。

**整改：** 改包名为 `geoserver/web/`。

### 问题 4: 包结构合理性

当前结构：
```
geoserver/
├── config/GeoServerProperties.java   ✓ 模块内横切配置
├── client/GeoServerClient.java       ✓ 模块内 HTTP 客户端
├── dto/                              ✓ 共享数据对象
├── service/                          ✓ 业务逻辑
└── controller/ → 改为 web/           ✗ 应改为 web/
```

对比项目其他模块（auth/, system/），结构合理。唯一改动：`controller/` → `web/`。

---

## 改动文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `geoserver/dto/DataStoreInfo.java` | 修改 | 删掉 type, workspaceName，只留 name + href |
| `geoserver/dto/FeatureTypeInfo.java` | 修改 | 删掉 title, nativeName, nativeBoundingBox，只留 name + href |
| `geoserver/dto/LayerInfo.java` | 修改 | 删掉 title, type, defaultStyle，只留 name + href |
| `geoserver/dto/WorkspaceInfo.java` | 不变 | 已经是 name + href |
| `geoserver/client/GeoServerClient.java` | 重写 | WebClient → RestClient |
| `geoserver/service/*.java` (4 个) | 修改 | Mono<> → 普通返回，配合 RestClient |
| `geoserver/controller/GeoServerController.java` | 移动+修改 | 移到 `web/` 包，Mono<> 去掉 |
| `geoserver/config/GeoServerProperties.java` | 不变 | 配置类无需改动 |
| `frontend/src/api/geoserver.ts` | 修改 | 类型字段同步简化 |
| `pom.xml` | 修改 | 删掉 webflux 依赖（如不再需要） |

### 不删除 webflux 依赖

保留 `spring-boot-starter-webflux`——后续可能有真正的异步场景（如 GeoServer 批量操作），RestClient 和 WebClient 可以共存。

---

## 验证

1. `mvn compile` 后端编译通过
2. `npx vue-tsc --noEmit` 前端编译通过
3. 启动后端 → `GET /api/geoserver/workspaces` 返回工作空间列表
4. 前端 03 页面正常加载、切换 Tab、加载图层
