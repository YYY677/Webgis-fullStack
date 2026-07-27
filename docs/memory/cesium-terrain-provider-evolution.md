---
name: cesium-terrain-provider-evolution
description: Cesium 1.142 地形 API 已变更，需用 CesiumTerrainProvider.fromUrl() 而非构造函数传 url
metadata:
  type: feedback
---

Mars3D 地形在 Cesium 1.142 中反复折腾才生效，根因是 Cesium 版本升级导致 API 变更：

**参考项目（Cesium 1.98）**：
```javascript
new Cesium.CesiumTerrainProvider({ url: '//data.mars3d.cn/terrain' })
```
构造函数直接传 `url` 就行。

**本项目（Cesium 1.142）**：
```typescript
await CesiumTerrainProvider.fromUrl('//data.mars3d.cn/terrain')
```
构造函数已不支持 `url` 参数（options 类型里没有），改用静态工厂方法 `fromUrl()`。

**踩过的坑**：
1. 直接用 `new CesiumTerrainProvider({ url })` → 构造函数不收 url，创建空 provider 导致地球变透明
2. 改用 `Cesium3DTilesTerrainProvider.fromUrl()` → 这是 3D Tiles 格式，Mars3D 是旧 quantized-mesh 格式，能渲染但不显示三维
3. 最终：`CesiumTerrainProvider.fromUrl()` → 正确，既有三维又不崩

**教训**：Cesium API 在不同主版本间变化大，不能凭经验直接用。先查类型定义确认 API 是否存在、签名对不对。

**关联**：[[cesium-imagery-layer-pattern]]
