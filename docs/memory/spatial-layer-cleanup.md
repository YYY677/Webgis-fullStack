---
name: spatial-layer-cleanup
description: 地图上按标签分类删除图层，不可依赖 ref 引用比对
metadata:
  type: reference
---

# OL 图层按标签清理

OL 图层管理：**不能用 `ref.value === mapLayer` 做引用比对删除**。

## 失败模式

| 方式 | 失败原因 |
| ---- | ---- |
| `map.removeLayer(ref.value)` | ref 只记住最后一个图层，之前的没记录 |
| `ref.value === all[i]` 引用比对 | OL Collection 事件系统内部包装了图层对象，JS `===` 跨指令边界不可靠 |
| 遍历全删所有 VectorLayer | 会把不该删的（输入图层、路网底图）也删掉 |

## 正确方式

创建图层时打自定义标签：

```typescript
layer.set("_analysisType", "result")   // 结果高亮图层
layer.set("_analysisType", "marker")   // 标记点图层
layer.set("_analysisType", "input")    // 输入几何图层
```

删除时遍历地图全量图层，按标签过滤：

```typescript
function cleanupResultLayer() {
  if (!map.value) return
  const all = map.value.getLayers().getArray()
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i] as any
    if (l.get?.("_analysisType") === "result" || l.get?.("_analysisType") === "marker") {
      map.value.removeLayer(l)
    }
  }
}
```

不依赖任何 ref 变量，直接读图层自带的属性做判断。

## 与遍历全删的区别

[[spatial-layer-cleanup-old]] 那个是旧版"遍历全删所有 VectorLayer"，适合"地图上只有一个业务矢量图层"的简单场景。新版适合多图层共存场景，按标签精准删除。

标签查找不依赖 JS 引用比对，100% 可靠。

**Why:** OL 的 `Collection` 在 `addLayer` 后可能对图层对象做事件绑定包装，导致 `===` 引用比对失败。

**How to apply:** 任何需要在地图上创建/销毁多类图层的组件，都应在创建时 `.set("_tag", "xxx")`，删除时按标签过滤。
