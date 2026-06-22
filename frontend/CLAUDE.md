# WebGIS Frontend · 前端工程

Vue 3 + TypeScript + Vite + OpenLayers/Cesium + Element Plus

## 技术栈

| 组件         | 版本     | 备注                             |
|--------------|----------|----------------------------------|
| Vue          | 3.5.32   | Composition API                  |
| TypeScript   | \~6.0    |                                  |
| Vite         | 8.0.8    | 构建工具                         |
| OpenLayers   | 10.9.0   | 2D 地图                          |
| CesiumJS     | 1.142.0  | 3D 地球，自托管于 public/Cesium/ |
| Element Plus | (待安装) | UI 组件库                        |
| Pinia        | 3.0.4    | 状态管理                         |
| vue-router   | 5.0.4    | 路由                             |
| Proj4        | 2.20.8   | 坐标转换                         |
| Node         | v22.13.0 |                                  |

## 标准项目结构

```
frontend/src/
├── main.ts                     # 入口：创建 app, 注册 Pinia/Router/ElementPlus
├── App.vue                     # 根组件 (布局壳)
│
├── api/                        # HTTP 请求层
│   ├── request.ts              # Axios 实例 + JWT 拦截器 + 错误处理
│   └── modules/                # 按模块拆分
│       ├── auth.ts             # 登录/注册 API
│       ├── spatial.ts          # 空间数据 API
│       ├── system.ts           # 系统管理 API
│       └── file.ts             # 文件上传 API
│
├── router/
│   └── index.ts                # 路由配置 + 导航守卫
│
├── stores/                     # Pinia 状态管理
│   ├── userStore.ts            # 用户/认证状态
│   ├── mapStore.ts             # 地图状态 (2D/3D, 中心点, 缩放)
│   └── layerStore.ts           # 图层状态 (列表, 开关, 透明度)
│
├── composables/                # 组合式函数 (逻辑复用)
│   ├── useMap.ts               # MapAdapter 核心 — 统一 2D/3D 接口
│   ├── useLayer.ts             # 图层管理逻辑
│   └── useAuth.ts              # 认证相关逻辑
│
├── components/                 # 公共组件
│   ├── common/                 # 通用 UI
│   │   ├── AppSidebar.vue      # 侧边导航
│   │   └── AppHeader.vue       # 顶部栏
│   └── map/                    # 地图相关
│       ├── MapContainer.vue    # 地图容器 (OpenLayers / Cesium 渲染)
│       ├── MapToolbar.vue      # 工具条 (测距、截图、全屏)
│       ├── LayerPanel.vue      # 图层控制面板
│       └── FeaturePopup.vue    # 要素详情弹窗
│
├── views/                      # 页面级组件
│   ├── dashboard/              # 工作台首页
│   │   └── index.vue
│   ├── map/                    # 地图主页面
│   │   ├── index.vue           # 2D 地图
│   │   └── Map3D.vue           # 3D 场景
│   ├── login/
│   │   └── index.vue           # 登录页
│   ├── system/                 # 系统管理
│   │   └── users.vue           # 用户管理
│   ├── upload/                 # 数据上传
│   │   └── index.vue
│   └── layers/                 # 图层管理页
│       └── index.vue
│
├── types/                      # TypeScript 类型定义
│   ├── map.ts                  # MapAdapter 接口、图层类型
│   ├── api.ts                  # API 响应类型
│   └── user.ts                 # 用户相关类型
│
├── utils/                      # 工具函数
│   ├── coordinate.ts           # 坐标转换工具
│   └── cesiumConfig.ts         # Cesium 配置常量
│
└── assets/                     # 静态资源 (图标、图片)
```

## 核心设计

### MapAdapter — 统一 2D/3D 地图接口

不直接耦合 OpenLayers 或 Cesium，通过 composables/useMap.ts 提供统一接口：

``` typescript
interface MapAdapter {
  init(container: HTMLElement, options?: MapOptions): void
  destroy(): void
  setCenter(lon: number, lat: number): void
  setZoom(zoom: number): void
  flyTo(lon: number, lat: number, zoom: number): void
  addLayer(layer: LayerConfig): void
  removeLayer(id: string): void
  setLayerVisibility(id: string, visible: boolean): void
  addFeature(feature: FeatureConfig): void
  onClick(callback: (e: MapClickEvent) => void): void
  getViewMode(): '2d' | '3d'
}
```

上层组件（MapContainer、LayerPanel）只依赖 MapAdapter 接口，不感知底层是 OL 还是 Cesium。

### Axios 请求层

```
api/request.ts: Axios 实例
  ├─ baseURL: /api (Vite proxy → :8080)
  ├─ 请求拦截器: 自动附加 JWT token
  └─ 响应拦截器: 统一错误处理 (401 → 跳转登录)

api/modules/*.ts: 按后端模块拆分
```

### 路由设计

```
/login           → 登录页 (无鉴权)
/dashboard       → 工作台概览
/map             → 2D 地图 (OpenLayers)
/map/3d          → 3D 场景 (Cesium)
/layers          → 图层管理
/system/users    → 用户管理 (admin only)
/upload          → 空间数据上传
```

### Vite 代理

开发时 Vite 代理两个路径：

```
/api/*        → http://localhost:8080   (Spring Boot)
/geoserver/*  → http://localhost:8081   (GeoServer)
```

## 待安装依赖

``` bash
npm install element-plus axios
```

## 开发命令

``` bash
npm run dev            # 启动开发服务器 :5173
npm run build          # 生产构建
npm run type-check     # TypeScript 类型检查
npm run lint           # ESLint + Oxlint
npm run format         # Prettier 格式化
```

## 遗留代码

当前 `src/views/` 中的旧文件保留作参考，逐步重构迁移：

- `OpenLayer/loadTiandiMap.vue` — 天地图 WMTS 示例
- `OpenLayer/clickEvent.vue` — GeoServer WFS 点击查询示例
- `Cesium/Cesium1.vue` — Cesium 基础初始化

新版代码按标准结构重建，旧代码迁移完可删除。
