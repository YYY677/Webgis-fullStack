---
name: cesium-3dtiles-pitfalls
description: 3D Tiles 操作中遇到的易错 bug 汇总
metadata:
  type: reference
---

# 3D Tiles 常见坑

## 1. `getPropertyNames()` 在 Cesium 1.142 已改为 `getPropertyIds()`

`scene.pick` 返回的 `Cesium3DTileFeature` 对象不再有 `getPropertyNames()` 方法。

- 新版：`feature.getPropertyIds()`
- 旧版：`feature.getPropertyNames()`
- `getProperty(name)` 方法签名未变

**解决**：运行时检测 `typeof feature.getPropertyIds === "function"`，降级到 `getPropertyNames`，兼容两个版本。

## 2. 按属性着色报错 `Operator ">=" requires number arguments`

倾斜摄影 tileset 的 `properties: null`，无任何属性。应用 `${height} >= 50` 等表达式时会抛出 GLSL 运行时错误。

**解决**：加载后检查 `tileset.properties`，为空时禁用所有属性相关的样式按钮，并给出提示。

## 3. 随机 HSL 颜色表达式语法错误

Cesium3DTileStyle 的 `color` 表达式是 GLSL 风格，不是 JS 字符串拼接。类似 `color('hsl(', ...)` 的多参数调用会失败。

**解决**：用 `conditions` 条件数组 + 固定颜色代替动态 HSL 计算。如 `${_id} % 8 === 0 → color('#e74c3c')`。

## 4. `Matrix4.fromRotationZ` 在 Cesium 1.142 不存在

该函数已移除。需要 `Matrix3.fromRotationZ` + `Matrix4.fromRotation` 两步构造。

```ts
const rMat3 = Matrix3.fromRotationZ(CesiumMath.toRadians(angle), new Matrix3())
const r = Matrix4.fromRotation(rMat3, new Matrix4())
```

## 5. modelMatrix 导致旋转后模型被视锥体裁剪

`tileset.modelMatrix` 中的旋转导致 Cesium 的包围盒计算异常，超过一定角度后 tileset 被判断为不可见而消失。

**解决**：每次 apply 先 `root.transform = originalRootTransform.clone()` 恢复原始状态，再 `modelMatrix = worldEdit`，确保每次从基线出发。同时启用 `tileset.dynamicScreenSpaceError = true` 放松裁剪阈值。

**复位**：恢复 `root.transform`、`modelMatrix = IDENTITY`、`dynamicScreenSpaceError = false`。

## 6. 样式重置只需 `style = undefined`

`tileset.style = undefined` 即可正确恢复默认外观，无需先设白色样式再清空的多余步骤。

## 7. `feature.color` 在样式激活时仍可高亮，但无法恢复

`feature.color` 设置的颜色**优先级高于** `Cesium3DTileStyle`——即使样式激活，设了 CYAN 就会显示 CYAN。真正的限制是无法恢复：

- 已设置的 `feature.color` 没有清除/回退 API
- 设 WHITE 并不能"回到样式颜色"——WHITE 本身就成了覆盖色
- 有样式时做高亮，除非一直不清除，否则无法优雅恢复

**结论**：无样式时用 `feature.color` 做高亮没问题（WHITE = 默认）。有样式时想要高亮应改用 `PostProcessStage` 描边，或不做高亮只看属性。

## 8. 关闭裁剪时 `clippingPlanes = undefined` 报 `Cannot read properties of undefined (reading '_target')`

关闭 3D Tiles 剖面（或 Globe 裁剪）时，若直接赋 `undefined` 会崩溃：

```ts
tileset.clippingPlanes = undefined  // ❌ 渲染停止：reading '_target'
```

**根因**（Cesium 1.142 源码）：`ClippingPlaneCollection.setOwner` 在赋新值时**立即 destroy 旧 collection**（`owner[key] = owner[key] && owner[key].destroy()`）。但 Model 的 draw command uniformMap 闭包仍持有旧 collection 引用，下一帧渲染时 `model_clippingPlanes` uniform 读 `clippingPlanes.texture` → 对象已销毁返回 undefined → `gl.bindTexture(v._target, ...)` 崩溃（createUniform.js 无空值保护）。

**解决**：关闭时只禁用，不销毁：

```ts
if (collection) collection.enabled = false  // ✅ 保留对象引用，渲染帧安全
```

页面卸载时同样先 `enabled = false` 再 `viewer.destroy()`。collection 最终随 viewer 销毁。

## 9. 建筑剖面（ClippingPlane）与"模型压平"是两回事

参考项目 `3.1.7、模型压平` 用 CustomShader 把建筑压扁（挖填方），**不是** ClippingPlane。真正的 3D Tiles 剖面：

```ts
tileset.clippingPlanes = new ClippingPlaneCollection({
  planes: [
    new ClippingPlane(new Cartesian3(0, -1, 0), 15), // 模型局部坐标，Y 通常为北
    new ClippingPlane(new Cartesian3(-1, 0, 0), 10),
  ],
  edgeWidth: 1.0,
  edgeColor: Color.YELLOW,
})
clipCollection.unionClippingRegions = true // 并集：任一平面内即裁剪
```

本质：GPU 片元着色器 `discard` 掉 `n·p + distance ≤ 0` 的片元，不改模型数据、不增加顶点，对 tileset 属性无要求（`tiles-buildings` 白模直接可用）。`unionClippingRegions = true` 取并集（两个方向都切），默认 false 取交集。
