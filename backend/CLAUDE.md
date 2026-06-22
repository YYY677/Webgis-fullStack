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
├── WebgisApplication.java        # 启动类
│
├── config/                       # Spring 配置 (横切)
│   ├── SecurityConfig.java       # Spring Security + JWT 无状态
│   ├── CorsConfig.java           # 跨域
│   ├── MyBatisPlusConfig.java    # 分页插件 + 自动填充
│   ├── UserDetailsServiceImpl.java
│   └── DataInitializer.java      # 首次启动创建 admin 账号
│
├── common/                       # 全局通用 (横切)
│   ├── Result.java               # 统一响应 {code, message, data}
│   ├── GlobalExceptionHandler.java
│   └── HealthController.java     # /api/health
│
├── auth/                         # 认证模块
│   ├── web/AuthController.java
│   ├── JwtTokenProvider.java
│   ├── JwtAuthFilter.java
│   ├── LoginUser.java            # UserDetails 实现
│   └── dto/
│       ├── LoginRequest.java
│       ├── LoginResponse.java
│       └── RegisterRequest.java
│
├── system/                       # 系统管理模块 (用户、角色、日志)
│   ├── entity/User.java          # @TableName("sys_user")
│   ├── mapper/UserMapper.java    # extends BaseMapper<User>
│   ├── service/UserService.java
│   └── web/UserController.java
│
├── spatial/                      # 空间数据模块 (待实现)
│   ├── entity/
│   ├── mapper/
│   ├── service/
│   └── web/
│
├── geoserver/                    # GeoServer 集成 (待实现)
│   └── GeoServerClient.java
│
└── file/                         # 文件上传模块 (待实现)
    └── FileUploadService.java
```

## 架构原则

### 模块化 + 内部分层

这是**推荐结构**。每个业务模块 (`auth/`, `system/`, `spatial/`) 内部按 Controller → Service → Mapper 三层组织，高内聚。

```
模块内:  web/ → service/ → mapper/ → entity/
                  ↑
跨模块引用: system/service/UserService ← 被 auth 模块引用
```

为什么不放一起：

- 模块多了之后扁平 controller/service/mapper 目录太深太长
- 改用户功能要跳 contoller → service → mapper 三个目录
- 模块化后要废弃用户模块直接删 `system/` 即可

### Controller → Service → Mapper 职责

| 层 | 包名 | 职责 | 注解 |
|-----------------|----------------------|-----------------|-----------------|
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
  POST /api/auth/login          # 登录 → JWT
  POST /api/auth/register       # 注册

空间数据 (USER 及以上):
  GET  /api/spatial/layers      # 图层列表
  POST /api/spatial/query       # 空间查询
  GET  /api/spatial/features/{layer}

文件 (USER 及以上):
  POST /api/files/upload/shp
  POST /api/files/upload/geojson

系统管理 (ADMIN):
  GET  /api/system/users        # 用户列表
  PUT  /api/system/users/{id}/status
```

## JWT 认证流程

```
1. 前端 POST /api/auth/login → 后端校验 → 返回 JWT
2. 前端 存储 token, 后续请求 Header: Authorization: Bearer <token>
3. JwtAuthFilter 拦截请求 → 校验 token → 设置 SecurityContext
4. SecurityConfig 基于角色控制 URL 权限
```

## 数据库

- PostgreSQL :5432, 数据库名 `webgis`
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
