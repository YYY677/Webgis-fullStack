---
name: cesium-globe-clipping-excavation
description: 地形开挖（Globe 裁剪）的正确算法与错误教训
metadata:
  type: reference
---

# 地形开挖（Globe 裁剪）正确做法

## 错误做法：单个水平平面切掉"上半球"

第一版实现用一个法线朝地心的平面：`distance ≈ 地球半径 + 偏移`，效果是**整个地表上半球被切除，露出地心黑洞**（乌漆嘛黑一片）。这就是"裁剪偏移"的语义：它把切割平面相对地表整体平移 ±2000m，等于对全世界做统一深度的切割，完全没有局部开挖效果，且交互语义令人困惑。

**教训**：Globe 裁剪平面距离以地心为原点（~6371km 量级），想"切地表以下一点"这种直觉会切掉半个地球。

## 正确算法（参考项目 4.1.1 / excavateTerrain.js）

开挖 = 用多边形**每条边一个竖直裁剪平面**围出局部区域，区域内部被 GPU 裁掉，再补底面与侧壁：

```ts
// 1. 每个顶点转 ECEF（逆时针顺序：西南 → 东南 → 东北 → 西北）
// 2. 每条边：法线 = 边方向 × 径向（朝外）
for (let i = 0; i < points.length; i++) {
  const next = points[(i + 1) % points.length]
  const midpoint = Cartesian3.add(points[i], next, new Cartesian3())
  Cartesian3.multiplyByScalar(midpoint, 0.5, midpoint)
  const up = Cartesian3.normalize(midpoint, new Cartesian3())
  const right = Cartesian3.normalize(
    Cartesian3.subtract(next, midpoint, new Cartesian3()), new Cartesian3(),
  )
  const normal = Cartesian3.normalize(
    Cartesian3.cross(right, up, new Cartesian3()), new Cartesian3(),
  )
  const distance = Plane.getPointDistance(new Plane(normal, 0.0), midpoint)
  planes.push(new ClippingPlane(normal, distance))
}
viewer.scene.globe.clippingPlanes = new ClippingPlaneCollection({ planes, edgeWidth: 1.0, edgeColor })
```

**保留侧语义（GLSL 确认）**：`amount = n·p + distance`，`amount ≤ 0` 的片元被 `discard`。法线朝外 ⇒ **区域内部（四个顶点）全在裁剪侧**，外部保留 → 视觉上"挖出坑"。

**验证技巧**：把 4 个顶点代入各平面的 `n·p + d`，全部 < 0 即正确（可用测试断言）。

## 补坑底与侧壁

- **坑底**：土色半透明 polygon，`height = 采样最低高程 − 开挖深度`
- **侧壁**：沿边界线性插值采样点（每边 ~20 点，含端点闭合环）→ `sampleTerrainMostDetailed` 取地形高程作 `maximumHeights`，坑底高作 `minimumHeights`，wall entity 渲染
- **WallGeometry 不自动闭合**：只连接相邻两个点（源码 `for (i = 0; i < length - 1; i++)`），4 角点只生成 3 面墙，最后一条边缺失露出裁切后的黑色空洞。闭合墙需末尾重复第一个角点：`[...corners, corners[0], corners[1]]`
- **开挖深度滑块**：只重建坑底/侧壁（深度变化不改裁剪平面）

## 关闭语义

与 3D Tiles 裁剪相同（见 [[cesium-3dtiles-pitfalls]] 第 8 条）：关闭用 `collection.enabled = false`，**不要** `globe.clippingPlanes = undefined`（立即 destroy 旧 collection，渲染帧引用已销毁对象报 `_target` 错误）。
