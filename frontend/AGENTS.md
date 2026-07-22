# 命令

``` bash
npm run dev      # 启动开发服务器 :5173
npm run build    # 类型检查 + 生产构建
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
├── layout/       # MainLayout 含侧边栏菜单
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
| `/ol-backend-demo/*` | 6 个页面 | GeoServer 加载、WFS CRUD、空间编辑器、数据管理、样式管理、空间分析 |
| `/cesium-frontend-demo/*` | 3 个页面 | 场景入门、坐标方位、事件监听 |
| `/:pathMatch(.*)` | 404 |  |

**项目特色**：mock 插件拦截 `/api/auth/*` 离线登录；7 种 OL 底图（`utils/basemaps.ts`）；14 种 Cesium 底图（`utils/cesium-basemaps.ts`）；侧边栏菜单在 `MainLayout.vue` 的 `menuList` 中定义。

# 技术笔记

- **OL 对象**：禁止 `ref()`，用 `shallowRef`（跨函数共享）或 `let`（局部/频繁创建）
- **Cesium 底图**：`ImageryLayer.fromWorldImagery()`，不用 `createWorldImageryAsync()`
- **Cesium 地形**：1.142 用 `CesiumTerrainProvider.fromUrl()`，构造函数已不支持 `url` 参数
- **图层清理**：`layer.set("_tag", "xxx")` 打标签，删除时遍历 `map.getLayers()` 按标签过滤，不用 `===` 引用比对
