# 命令

``` bash
npm run dev      # 启动开发服务器 :5173
npm run build    # 类型检查 + 生产构建
npm run test     # 运行 Vitest
npm run preview  # 预览构建产物
```

# 技术栈

| 组件 | 版本 | 备注 |
|------|------|------|
| Vue | ^3.5.32 | Composition API + setup |
| TypeScript | ~5.9.3 | strict 模式 |
| Vite | ^7.3.1 | proxy /api → :8080, /geoserver → :8081 |
| Element Plus | ^2.13.1 | 中文 locale，暗黑 `html.dark` |
| OpenLayers | ^10.9.0 | 2D 地图 |
| CesiumJS | ^1.142.0 | 3D 地球（自托管，无 Ion token） |
| ECharts | ^6.1.0 | 图表 |
| Pinia | ^3.0.4 | 状态管理 |
| axios | ^1.13.2 | 拦截器 code===200 判成功 |

# 目录结构

```
src/
├── api/          # HTTP 请求
├── router/       # 路由表 + 守卫（hash 模式）
├── stores/       # Pinia（app/user）
├── layout/       # AtlasLayout：侧边栏、标签页和主内容区域
├── components/   # 可复用组件
├── composables/  # 组合式函数
├── utils/        # 底图配置、localStorage 等
├── styles/       # SCSS + CSS 变量
├── pages/        # 页面视图
├── plugins/      # 插件注册
├── assets/       # 静态资源
└── types/        # TS 定义
```

# 路由与页面

Hash 路由，守卫检查 localStorage token 控制登录态。

| 路由 | 页面 | 说明 |
|------|------|------|
| `/login` | 登录页 | mock 插件可离线登录 |
| `/dashboard` | 首页 |  |
| `/demo/element-plus` | 组件示例 |  |
| `/ol-frontend-demo/*` | 6 个页面 | 底图切换、基础工具、加载数据、图层控制、地图设置、echart图表使用 |
| `/ol-fullstack-demo/*` | 6 个页面 | GeoServer 加载、WFS CRUD、空间编辑器、数据管理、样式管理、空间分析 |
| `/cesium-demo/*` | 19 个页面 | Cesium 基础、实体与 Primitive、数据加载、3D Tiles、动态轨迹、标注编辑、图层管理、性能、粒子、裁剪与淹没等 |
| `/cesium-fullstack-demo/*` | 3 个页面 | GeoServer WMS/WMTS/WFS 接入、PostGIS 空间要素 CRUD、服务端空间分析与 pgRouting 路径 |
| `/:pathMatch(.*)` | 404 |  |

**项目特色**：Hash 路由由 `router/index.ts` 集中定义，壳组件是 `layout/AtlasLayout.vue`；Vite 将 `/api` 转发到 Spring Boot `:8080`，将 `/geoserver` 转发到 GeoServer `:8081`。课程目录由各自的 `*-learning-catalog.ts` 维护。

## 全栈边界

- OpenLayers 与 Cesium 的纯前端课程不依赖后端业务 API。
- GeoServer 服务课程直接经 Vite 代理访问 `/geoserver/wms`、`/geoserver/wfs`、`/geoserver/gwc/service/wmts`，因此依赖 GeoServer 与 PostGIS。
- Cesium 全栈 CRUD 复用 `api/spatial-data.ts` 的 `/api/spatial/**`；服务端分析复用 `api/spatial-analysis.ts` 的 `/api/spatial/analysis/**`；它们不是单独的“Cesium 后端”。
- 需要管理工作空间、数据存储、图层或样式时，调用 `api/geoserver.ts` 的 `/api/geoserver/**` 后端代理，而不是把 GeoServer 管理员凭据写进浏览器。
