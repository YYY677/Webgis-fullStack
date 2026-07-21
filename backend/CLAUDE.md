# WebGIS Backend · 后端工程

Spring Boot 3.5 + MyBatis-Plus + GeoTools + PostgreSQL/PostGIS

## 技术栈

| 组件 | 版本 | 备注 |
|----|----|----|
| Java | 17 | SB 3.5 最低要求 17，项目实际使用 17 |
| Spring Boot | 3.5.15 | Jakarta EE 10 |
| MyBatis-Plus | 3.5.12 | boot3 变体，适配 Jakarta EE |
| GeoTools | 35.0 | **必须 35.x**，34.x 用 javax.\* 不兼容 |
| PostgreSQL Driver | (由 SB parent 管理) |  |
| Flyway | (由 SB parent 管理) | 数据库迁移 |
| jjwt | 0.12.6 | JWT 签发与校验 |
| Lombok | (由 SB parent 管理) |  |

## 目录结构与分层

```
backend/src/main/java/com/webgis/
│
├── config/          # Spring 配置（Security/CORS/MyBatis-Plus/DataInit）
├── common/          # 全局通用（Result 统一响应/ExceptionHandler/Health）
├── auth/            # 认证模块（Controller + JwtProvider + JwtFilter + DTO）
├── system/          # 系统管理（User CRUD, ADMIN 权限）
├── spatial/         # 空间数据（SpatialData 动态CRUD + SpatialAnalysis JTS/pgRouting）
├── geoserver/       # GeoServer 集成（最复杂模块）
│   ├── config/      #   GeoServerProperties
│   ├── client/      #   RestClient 封装（GET/POST/PUT/DELETE/XML）
│   ├── service/     #   6 services: Workspace/DataStore/FeatureType/Layer/Upload/Style
│   ├── style/       #   SldParser + SldModifier（DOM+XPath 增删改）
│   ├── web/         #   GeoServerController + StyleController
│   └── dto/         #   6 DTOs
└── file/            # 文件上传（集成在 geoserver 模块中）
```

## 架构原则

### 模块化 + 内部分层

这是**推荐结构**。每个业务模块 (`auth/`, `system/`, `spatial/`) 内部按 Controller → Service → Mapper 三层组织，高内聚。

```
模块内:  web/ → service/ → mapper/ → entity/
                  ↑
跨模块引用: system/service/UserService ← 被 auth 模块引用
```

为什么不放在一起：

- 模块多了之后扁平 controller/service/mapper 目录太深太长
- 改用户功能要跳 controller → service → mapper 三个目录
- 模块化后要废弃用户模块直接删 `system/` 即可

### Controller → Service → Mapper 职责

| 层 | 包名 | 职责 | 注解 |
|-----------------|---------------------|-----------------|-----------------|
| Controller | `*.web/` | 接收 HTTP 请求、参数校验、调用 Service、返回 Result | `@RestController` |
| Service | `*.service/` | 业务逻辑、事务管理、跨模块调用 | `@Service` |
| Mapper | `*.mapper/` | 数据库操作、SQL 映射 | `@Mapper extends BaseMapper<T>` |

### 统一响应体

所有 API 返回 `Result<T>`:

``` json
{ "code": 200, "message": "success", "data": {...} }
```

## REST API 设计

```
认证 (无需鉴权):
  POST /api/auth/login         # 登录 → JWT
  POST /api/auth/register      # 注册
  GET  /api/auth/me            # 当前用户（需认证）

空间数据 CRUD (当前公开, /api/spatial/data/*):
  查询: tables/fields/page   行操作: save/update/delete

空间分析 (当前公开, /api/spatial/analysis/*):
  buffer/intersection/union/difference/symdiff — 几何运算
  relation/distance/area/length/centroid      — 量算
  shortest-path                                — pgRouting 最短路径

GeoServer 管理 (当前公开, /api/geoserver/*):
  资源生命周期: workspaces → datastores → feature-types → layers
  上传: upload (Shapefile/GeoJSON)
  样式: styles CRUD + SLD XML 读写 + 可编辑值查询/更新

系统管理 (ADMIN):
  GET  /api/system/users
  PUT  /api/system/users/{id}/status

健康检查:
  GET  /api/health
```

## JWT 认证流程

```
1. 前端 POST /api/auth/login → 后端校验 → 返回 JWT
2. 前端 存储 token, 后续请求 Header: Authorization: Bearer <token>
3. JwtAuthFilter 拦截请求 → 校验 token → 设置 SecurityContext
4. SecurityConfig 基于角色控制 URL 权限
```

## 数据库

- PostgreSQL :5432, 数据库名 `webgistest`
- Flyway 管理表结构，迁移脚本在 `resources/db/migration/`
- 两个 schema: `business_data` (用户/日志) + `spatial_data` (图层/空间数据)
- 首次启动 `DataInitializer` 自动创建 admin/admin123

## 开发命令

``` bash
cd backend
mvn spring-boot:run                           # 启动
mvn spring-boot:run -Dspring-boot.run.profiles=dev  # 开发模式 (SQL 打印)
mvn compile                                   # 编译
mvn test                                      # 测试
```

## Maven 仓库

GeoTools 发布在 OSGeo 仓库（非 Maven Central），pom.xml 已配置:

``` xml
<repository>
    <id>osgeo</id>
    <url>https://repo.osgeo.org/repository/release/</url>
</repository>
```

## 关键坑点

1. **GeoTools 版本**: 必须 35.x (`jakarta.*`)，34.x 用 `javax.*` 与 SB 3.5 冲突
2. **MyBatis-Plus**: 用 `mybatis-plus-spring-boot3-starter`，不能用普通版本（javax）
3. **PostGIS 空间字段**: MyBatis-Plus 无 Hibernate Spatial 支持，需手写 TypeHandler 处理 Geometry 类型
4. **SQL 别名引号**: PG 无引号别名转小写，`SELECT col AS camelCase` 在 Java Map get("camelCase") 拿不到 → 加双引号 `AS "camelCase"`
5. **SERIAL PK 排除**: INSERT 时不能列出自增主键，`INSERT INTO t (gid, name) VALUES (null, 'x')` 违反 NOT NULL → 字段列表排除 `gid`
6. **Flyway checksum**: 已执行的迁移文件不可修改内容，否则启动报 checksum mismatch → 追加新版本 V3，不改 V1/V2
7. **GeoServer 中文 SLD**: 发中文 XML body 用 `xmlBody.getBytes(StandardCharsets.UTF_8)` + `MediaType.APPLICATION_XML.withCharset("UTF-8")`，String 默认 ISO-8859-1 会乱码
8. **GeoServer Content-Type**: Style 端点极敏感，SLD 创建/更新用 `application/vnd.ogc.sld+xml`，别用 `application/xml`（报 No such style handler）
9. **pgRouting 列映射**: `pgr_dijkstra` 需 `id, source, target, cost` 四列；pgr 结果和路网表同名列需别名区分；路径拼接用 PostGIS `ST_LineMerge(ST_Collect(...))`，不要 Java 手拼 WKT
