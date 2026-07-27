---
name: cesium-imagery-layer-pattern
description: Cesium 默认底图用 ImageryLayer.fromWorldImagery() 而非 createWorldImageryAsync()
metadata:
  type: feedback
---

Viewer 默认底图使用的是 `ImageryLayer.fromWorldImagery()`（返回 ImageryLayer），不是 `createWorldImageryAsync()`（返回 Promise\<ImageryProvider\>）。后者在 Cesium 1.142 中获取 Bing Maps key 的路径不同，容易失效。前者是 Viewer 构造函数 `baseLayer` 的默认值，和 `new Viewer()` 保持一致。

**导致绕路的原因**：
- `IonImageryProvider` 在 Cesium 1.142 中已弃用，构造报错
- `createWorldImageryAsync()` 虽然不报错但底层 key 获取路径不同，运行时可能失败
- cesium.map.min.js 是 UMD 脚本不适合 Vite/ESM，加载问题花了很多精力调试

**教训**：添加新底图时，如果 Viewer 本身有现成的默认实现（`fromWorldImagery` 等），优先复用而不是另找 API。工厂接口要灵活——一开始设计 `create() => ImageryProvider` 太死板，导致 `ImageryLayer.fromWorldImagery()` 这种返回 Layer 的 API 塞不进去。改成 `activate(viewer) => Promise<void>` 后各条目自己控制激活逻辑，兼容所有场景。

**关联**：[[srid-4326-convention]]、[[ol-ref-pattern]]
