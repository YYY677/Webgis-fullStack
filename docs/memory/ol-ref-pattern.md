---
name: ol-ref-pattern
description: OpenLayers 对象在 Vue 3 中禁用 ref，统一用 shallowRef 或 let
metadata: 
  node_type: memory
  type: reference
  originSessionId: 103457d9-2ae8-4eb4-861a-cc967b39ccaa
---

## 规则

OL 对象**不能使用 `ref()`**。Vue 3 的 `ref()` 对对象做 deep reactive proxy，会干扰 OL 内部的 `instanceof` 检查、getter/setter 和原型链，导致运行时错误。

## 选择策略

| 方式 | 适用场景 | 原因 |
|---|---|---|
| `shallowRef<T>` | 需要被模板/事件处理读取、跨函数共享的 OL 层、Source 等 | 只代理 `.value` 赋值，不侵入对象内部，OL 正常工作 |
| `let` | 频繁创建销毁的交互（Draw、Modify、Select） | 无模板依赖，`let` 最轻量，配合 `cleanupInteractions()` 管理生命周期 |
| `const` | 一次性创建的工具对象（WKT、WFS、Format 类） | 引用永不改变 |

## 判断流程

```
这个 OL 对象是否需要被多个函数访问（跨事件/生命周期）？
  ├─ 否 → let（局部变量足够）
  └─ 是 ─ 是否需要响应式更新（模板绑定、watch、computed 依赖）？
       ├─ 是 → shallowRef
       └─ 否 → let
```

实际上大多数 OL 对象在组件内只需 `let`，只有类似 `vectorLayer` 这种在 `loadFeaturesToMap` 中创建、在 `onRowClick` 中被读取的跨函数场景才需要 `shallowRef`。

**Why:** 早期尝试用 `ref` 包裹 `VectorLayer` 等 OL 对象时，Vue 的 Proxy 拦截了 OL 内部属性访问，导致渲染异常、`getSource()` 返回 undefined 等诡异问题。改用 `shallowRef` 后问题消失。
**How to apply:** 写代码时一律默认用 `let`，仅在确认需要响应式追踪时才用 `shallowRef`；永远不用 `ref`。
