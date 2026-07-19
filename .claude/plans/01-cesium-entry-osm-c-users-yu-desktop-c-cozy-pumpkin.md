# 修复计划：底图加载错误 + Mars3D 补充

## Context

用户反馈了 3 个运行时错误，并指出 Mars3D 底图类型不完整。

## Bug 修复

### Bug 1：Cesium Ion 切换失败

**错误**：`Cannot read properties of undefined (reading 'tilingScheme')`

**根因**：Cesium 1.142 中 `IonImageryProvider` 构造函数已被弃用，改用 `Cesium.createWorldImageryAsync()` 异步工厂方法。

**修复**：在 `cesium-basemaps.ts` 中，将 Ion 底图的 `create` 改为：

```typescript
create: async () => {
  return await Cesium.createWorldImageryAsync()
}
```

同时调整 `01-cesium-entry.vue` 中的 Ion -> OSM 两级降级逻辑为 OSM 单一 fallback（单张图片作 fallback 也不稳妥）。

### Bug 2：单张世界图切换失败

**错误**：`Expected options.tileWidth to be typeof number, actual typeof was undefined`

**根因**：`SingleTileImageryProvider` 构造函数需要 `tileWidth`/`tileHeight` 参数。类型标注为 optional，但运行时做了严格校验。

**修复**：在 `cesium-basemaps.ts` 的 `single-world` 条目中显式传入图片尺寸：

```typescript
create: async () => {
  return new SingleTileImageryProvider({
    url: "/cesium-assets/world_b.jpg",
    tileWidth: 2048,
    tileHeight: 1024,
  })
}
```

### Bug 3：中国地图服务全部报"脚本未加载"

**错误**：`cesium.map.min.js 未加载`

**根因**：`loadScript()` 中设置了 `script.crossOrigin = "anonymous"`，而 Vite 为 `/public/` 静态资源默认不返回 CORS 头，导致脚本加载触发 onerror。同域加载不需要 crossOrigin。

**修复**：在 `01-cesium-entry.vue` 的 `loadScript()` 中移除 `crossOrigin` 行，同时在 catch 分支加 `console.error` 方便调试。

## 功能补充

### Mars3D 底图扩展

当前只有 `Mars3D 影像` (img)。参考项目中 `data.mars3d.cn/tile/` 还提供：

- `img` — 卫星影像（已有）
- `vec` — 矢量地图
- `ter` — 地形晕渲

另外有 `data.mars3d.cn/terrain` 地形服务（高程），但这不是影像底图，暂不加入底图切换面板。

**修复**：在 `cesium-basemaps.ts` 的"在线标准服务"组中增加两项：

```typescript
{ id: "mars3d-vec", label: "Mars3D 矢量", url: "//data.mars3d.cn/tile/vec/{z}/{x}/{y}.jpg" }
{ id: "mars3d-ter", label: "Mars3D 地形晕渲", url: "//data.mars3d.cn/tile/ter/{z}/{x}/{y}.jpg" }
```

## 变更文件

只改 2 个已有文件，不新建：

- `cesium-basemaps.ts` — ① Ion 改用 `createWorldImageryAsync`；② SingleTile 加 tileWidth/tileHeight；③ 增加 Mars3D 矢量+地形晕渲
- `01-cesium-entry.vue` — ① `loadScript()` 移除 crossOrigin；② catch 加 console.error

## 验证

```bash
cd frontend && npx vue-tsc --noEmit
cd frontend && npm run dev
```

1. 页面加载后 Cesium Ion 底图正常显示
2. 切换到"单张世界图"正常显示世界地图
3. 切换到任一中国地图服务正常显示
4. Mars3D 矢量/地形晕渲两项可正常切换
