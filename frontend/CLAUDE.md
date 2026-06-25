@AGENTS.md

---

# WebGIS Frontend · 速览

## 启动

```bash
npm run dev    # → http://localhost:5173
```

任意用户名密码登录（Mock 模式）。

## 关键文件

| 文件 | 说明 |
|------|------|
| `vite.config.ts` | 代理配置、Mock 插件、Cesium 插件 |
| `src/router/index.ts` | 路由表 |
| `src/layout/MainLayout.vue` | 侧边栏 + 顶栏 + 内容区（全部在一个文件） |
| `src/stores/user.ts` | 用户登录状态 |
| `src/composables/usePagination.ts` | 分页逻辑（Element Plus 示例页用到） |
| `src/pages/map-demo/*` | 3 个地图 Demo 页面 |

## 侧边栏

```
首页          /dashboard
组件示例       /demo/element-plus
Map Demo      /map-demo
  ├─ 天地图    /map-demo/tianditu
  ├─ WFS 查询  /map-demo/wfs
  └─ Cesium 3D /map-demo/cesium
```
