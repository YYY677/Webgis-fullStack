---
name: cesium-particle-pitfalls
description: ParticleSystem 粒子显示失败的三个根因（时钟、尺寸、地形深度测试）
metadata:
  type: reference
---

# Cesium 粒子系统常见坑

## 粒子点击后看不到效果

`ParticleSystem` 创建并 `scene.primitives.add()` 后看不见，通常是以下三个问题之一（参考项目 `5.4.1、火焰.html` 的正确做法）：

### 1. 时钟未开启动画（最常见的根因）

粒子系统由 Cesium 时钟驱动更新，`viewer.clock.shouldAnimate = false` 时系统永不推进：

```ts
viewer.clock.shouldAnimate = true // ✅ 必须显式开启
```

### 2. 粒子尺寸过小 + 被地形深度剔除

- 像素尺寸（`imageSize: 25` 默认像素）在相机远处几乎不可见。参考项目用 **`sizeInMeters: true`**，25 米大的粒子在任何距离都可见。
- 粒子埋在地形表面以下时被剔除。参考项目在创建效果时显式关闭地形深度测试，清除时恢复：

```ts
viewer.scene.globe.depthTestAgainstTerrain = false // 创建时
viewer.scene.globe.depthTestAgainstTerrain = true  // 清除时
```

### 3. 参数模式：范围值 + 大尺度变化

参考项目的参数特征（让粒子有自然差异和体积感）：

```ts
new ParticleSystem({
  modelMatrix: Transforms.eastNorthUpToFixedFrame(position),
  emitter: new ConeEmitter(CesiumMath.toRadians(45)), // 锥形向上
  minimumParticleLife: 1, maximumParticleLife: 6,
  minimumSpeed: 1, maximumSpeed: 4,
  startScale: 0, endScale: 10,        // 0 → 10 倍膨胀
  imageSize: new Cartesian2(25, 25),  // 配合 sizeInMeters
  sizeInMeters: true,
  loop: true,                         // lifetime 内循环
  emissionRate: 5,
  lifetime: 16,
})
```

## 运行时调参

`ParticleSystem` 的属性是公开 getter/setter（`emissionRate`、`minimumParticleLife`、`imageSize` 等），滑块事件里直接写入即可实时生效，无需重建系统：

```ts
system.emissionRate = 80
system.minimumParticleLife = 0.6
system.maximumParticleLife = 1.5
system.imageSize = new Cartesian2(30, 30)
```

注意：`imageSize` 是 `Cartesian2`，必须新建对象赋值。

## 内置四种发射器

`CircleEmitter`（圆形面）、`ConeEmitter`（锥形，默认向上）、`SphereEmitter`（球形）、`BoxEmitter`（盒形）。爆炸效果用 `emissionRate: 0` + `bursts: [new ParticleBurst({ time: 0, minimum: 200, maximum: 300 })]` 一次性爆发。
