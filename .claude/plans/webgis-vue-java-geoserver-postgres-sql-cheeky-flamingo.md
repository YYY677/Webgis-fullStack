# GeoServer REST API 集成 + 数据迁移

## Context

用户后端已能运行。当前任务：
1. 实现 GeoServer REST API 客户端（Workspace/DataStore/FeatureType/Layer 核心 CRUD）
2. 前端 `03-geoserver-rest.vue` 以地图+侧面板形式展示管理功能
3. 数据迁移：public schema 下 11 张空间表编入 `spatial_data.layer_catalog`，原表保留

## Part 1: 数据迁移 (Flyway V2)

### 现状

`public` schema 下有 11 张表：

| 表名 | 类型 | 用途 |
|------|------|------|
| port, port_bak | GeoServer WFS 演示 | 港口点位 |
| province_border | GeoServer 图层 | 省份面 |
| capital | GeoServer 图层 | 省会 |
| layer_edit, layer_university, mvt_test, test_polygon, shenzhen_roads, shenzhen_roads_vertices_pgr | 测试/空间分析 | 各种演示数据 |
| spatial_ref_sys | PostGIS 系统表 | 坐标系定义 |

`business_data.sys_user` — 已由 V1 创建
`spatial_data.layer_catalog` — 已由 V1 创建（空表，等待数据）

### 迁移策略

**不能移动物理表**（会破坏 GeoServer 发布的数据存储引用），改为：
- V2 迁移脚本：把 public 下每张空间表登记到 `spatial_data.layer_catalog`，记录 name/geometry_type/srid/table_name
- 原表全部保留在 public，不加修改
- V2 幂等（使用 INSERT ON CONFLICT DO NOTHING）

### 改动文件

| 文件 | 操作 |
|------|------|
| `backend/src/main/resources/db/migration/V2__catalog_existing_layers.sql` | 新建 |

---

## Part 2: GeoServer REST API 后端

### 包结构

```
backend/src/main/java/com/webgis/geoserver/
├── config/
│   └── GeoServerProperties.java      # @ConfigurationProperties("geoserver")
├── client/
│   └── GeoServerClient.java          # WebClient 封装，统一处理认证/错误
├── dto/
│   ├── WorkspaceInfo.java            # Workspace 摘要 DTO
│   ├── DataStoreInfo.java            # DataStore 摘要 DTO
│   ├── FeatureTypeInfo.java          # FeatureType 摘要 DTO
│   └── LayerInfo.java                # Layer 摘要 DTO
├── service/
│   ├── WorkspaceService.java         # 工作空间 CRUD
│   ├── DataStoreService.java         # 数据存储 CRUD
│   ├── FeatureTypeService.java       # 要素类型查询
│   └── LayerService.java             # 图层查询/发布
└── controller/
    └── GeoServerController.java      # REST 接口暴露给前端
```

### 关键设计

**GeoServerClient.java：**
- 注入 `GeoServerProperties`，构造 `WebClient.builder().baseUrl(props.getUrl())`
- 默认认证：`defaultHeaders(h -> h.setBasicAuth(username, password))`
- 通用错误处理：`onStatus(HttpStatusCode::isError, res -> ...)`
- 封装 `get()`, `post()`, `put()`, `delete()` 四个通用方法，返回 `Mono<T>`

**Service 层职责：**
- 每个 Service 对应一个资源类型
- 包装 GeoServer REST API 的 JSON/XML 响应为统一 DTO
- 调用 `GeoServerClient` 的方法，处理响应反序列化

**Controller 层：**

| 端点 | 方法 | 说明 |
|------|------|------|
| `GET /api/geoserver/workspaces` | 列表 | 获取所有工作空间 |
| `POST /api/geoserver/workspaces` | 创建 | 创建新工作空间 |
| `GET /api/geoserver/datastores?ws={ws}` | 列表 | 获取指定 ws 的数据存储 |
| `POST /api/geoserver/datastores` | 创建 | 创建 PostGIS 数据存储 |
| `GET /api/geoserver/featuretypes?ws={ws}&ds={ds}` | 列表 | 获取要素类型 |
| `GET /api/geoserver/layers?ws={ws}` | 列表 | 获取已发布图层 |
| `POST /api/geoserver/layers/publish` | 发布 | 将 FeatureType 发布为 Layer |

### API 统一响应

所有 GeoServer Controller 也用 `Result<T>` 包装返回：
```json
{ "code": 200, "message": "success", "data": { ... } }
```

### 改动文件

| 文件 | 操作 |
|------|------|
| `backend/pom.xml` | 添加 `jackson-dataformat-xml`（GeoServer XML 响应解析） |
| `backend/.../geoserver/config/GeoServerProperties.java` | 新建 |
| `backend/.../geoserver/client/GeoServerClient.java` | 新建 |
| `backend/.../geoserver/dto/*.java` | 4 个新 DTO |
| `backend/.../geoserver/service/*.java` | 4 个新 Service |
| `backend/.../geoserver/controller/GeoServerController.java` | 新建 |
| `backend/.../config/SecurityConfig.java` | 修改：放开 `/api/geoserver/**` 认证 |

---

## Part 3: 前端 03-geoserver-rest.vue

### 布局

```
[地图区域]
├── 搜索框（左上）
├── 右侧控件列：BasemapSwitcher + MapSetting + LayerControl
└── GeoServer 管理面板（右侧，可折叠）
    ├── Tab: 工作空间 | 数据存储 | 要素类型 | 图层
    ├── 每个 Tab 内：列表 + 刷新按钮 + 创建按钮
    └── 创建表单：el-dialog 弹窗
```

### 面板设计

- 使用 `el-tabs` 切换四个资源类型
- 每个 Tab 内用 `el-table` 展示列表
- 顶部工具栏：`el-button` 刷新 + 创建
- 创建操作：`el-dialog` 弹窗 + `el-form`
- Workspace 创建：名称 + URI
- DataStore 创建：名称 + 数据库连接参数
- Layer 发布：选择 DataStore → 选择 FeatureType → 确认发布

### API 调用

复用项目已有的 axios 实例，调用后端 `/api/geoserver/**` 接口。

### 路由

已有路由 `/ol-backend-demo/geoserver-wfs`（02），新增 03：
```ts
{
  path: "geoserver-rest",
  name: "GeoserverRest",
  component: () => import("@/pages/ol-backend-demo/03-geoserver-rest.vue"),
  meta: { title: "03-GeoServer REST API" },
}
```

### 改动文件

| 文件 | 操作 |
|------|------|
| `frontend/src/pages/ol-backend-demo/03-geoserver-rest.vue` | 新建 |
| `frontend/src/router/index.ts` | 添加路由 |
| `frontend/src/api/geoserver.ts` | 新建 API 封装 |

---

## 开发顺序

```
1. Flyway V2 迁移脚本
2. GeoServerProperties + GeoServerClient
3. WorkspaceService + Controller → Workspace 接口
4. DataStoreService + Controller → DataStore 接口  
5. FeatureTypeService + Controller → FeatureType 接口
6. LayerService + Controller → Layer 接口
7. 前端 03 页面 + API 封装 + 路由
```

## 验证

1. `mvn compile` 后端编译通过
2. 启动后 `GET /api/geoserver/workspaces` 返回 GeoServer 工作空间列表
3. 前端 `03-geoserver-rest` 页面面板显示工作空间，可创建/查看
