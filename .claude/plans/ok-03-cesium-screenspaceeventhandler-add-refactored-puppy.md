# 03 Cesium 事件页面 — 精简重构

## 当前问题

现有页面过度设计，理解成本高：
- `sseh` 前缀费解
- toast 浮动通知意义不大
- 事件日志 + 时间戳堆积信息
- 三个独立输出区（pick/move/wheel）碎片化
- `throttle` 工具函数暴露了实现细节

## 简化原则

> 一个事件 = 一行开关 + 一行结果。没有中间层，没有缩写。

## 新布局

左侧三张卡片，每张内事件条目垂直排列，每个条目格式统一：

```
┌─────────────────────────────────────┐
│ [开关] 事件名   注册方法签名          │
│        → 事件触发时的输出             │
├─────────────────────────────────────┤
│ [开关] 事件名   注册方法签名          │
│        → 事件触发时的输出             │
└─────────────────────────────────────┘
```

### 卡片一：ScreenSpaceEventHandler — 鼠标事件

每条展示：**事件名 + `handler.setInputAction(fn, 事件类型)` + 开关 + 触发结果**

| 事件 | 开关默认 | 触发时显示 |
|------|---------|-----------|
| LEFT_CLICK | ON | `→ 屏幕(450,320) 116.39°E, 39.91°N 5210m` |
| LEFT_DOUBLE_CLICK | OFF | `→ 已飞至点击位置`（实际执行 flyTo） |
| RIGHT_CLICK | OFF | `→ 右键触发` |
| MOUSE_MOVE | OFF | `→ (320, 240) 116.39°E, 39.91°N`（实时更新） |
| WHEEL | OFF | `→ 🔺放大 Δ120` 或 `→ 🔻缩小 Δ120` |

### 卡片二：Camera 事件 (addEventListener)

每条展示：**事件名 + `camera.xxx.addEventListener(fn)` + 开关 + 状态/计数**

| 事件 | 显示 |
|------|------|
| moveStart | `●` 移动中指示 + 触发次数 |
| moveEnd | `○` 静止指示 + 触发次数 |
| changed | 实时高度 km + 触发次数 |

### 卡片三：Scene & Clock 事件 (addEventListener)

| 事件 | 显示 |
|------|------|
| scene.postRender | 累计帧数 |
| scene.preRender | 上一帧间隔 Δ ms |
| clock.onTick | 当前仿真时间（ISO格式） |

### 被移除的部分

| 移除项 | 原因 |
|--------|------|
| `sseh` 缩写 | 改成 `clickResult` / `moveCoord` / `wheelInfo` 等直白命名 |
| toast 通知条 | 学习页面不需要这个 |
| 事件日志（含时间戳、清空按钮） | 事件触发结果直接显示在条目下方，不需要独立日志 |
| `pushLog` / `showToast` / `throttle` 暴露 | 精简代码，throttle 保留行为但隐藏实现 |
| 所有相关 CSS（toast 动画、日志列表） | — |

## 修改文件

| 文件 | 操作 |
|------|------|
| `frontend/src/pages/cesium-frontend-demo/03-cesium-events.vue` | 重写 |

路由无需修改（已注册）。

## 验证

1. `npm run build` 通过
2. 每个开关可独立启停
3. LEFT_CLICK 默认 ON，点击地图显示坐标
4. LEFT_DOUBLE_CLICK 开启后双击，相机飞入
5. MOUSE_MOVE 开启后移动鼠标，坐标实时更新
6. WHEEL 开启后滚轮，显示缩放方向
7. Camera 事件启停正常，状态指示正确
8. Scene/Clock 事件开启后帧数和仿真时间更新
