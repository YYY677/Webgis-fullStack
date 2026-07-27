# Cesium 相机姿态滑块

适用于通过 `camera.setView({ orientation })` 与 UI 滑块双向控制 `heading`、`pitch`、`roll` 的页面。

本记录针对本项目的 Cesium `1.142.0`。下文关于近垂直分支的阈值来自该版本 `Camera.js` 的 `getHeading` 与 `getRoll` 实现；升级 Cesium 后应重新核对。

## HPR 的参考系不是固定世界轴

在 3D 模式中，`setView` 会在相机位置建立局部 East-North-Up（ENU，东-北-天）参考系，再将 HPR 转换成相机的 `direction`、`up`、`right` 向量。因此，Heading、Pitch、Roll 描述的是该局部参考系中的相对姿态，不应简单解释为始终绕世界坐标的 Z、Y、X 轴旋转。

这也解释了同一组数值在不同地理位置、不同 `camera.transform` 下的世界空间方向可能不同。页面注释和教学文案应使用“局部方位 / 视线 / 画面”来解释，不要把全局坐标轴写死。

## Roll 回读范围必须归一化

`camera.roll` 的回读范围为 `[0°, 360°]`；`0°` 与 `360°` 表示相同姿态。如果 UI Roll 使用 `[-180°, 180°]`，直接赋值会产生越界值。

- `360°` 应显示为 `0°`；
- `270°` 应显示为 `-90°`。

在同步 UI 前转换：

```ts
function toSignedRollDegrees(rollRadians: number): number {
  const degrees = CesiumMath.toDegrees(rollRadians)
  const signedDegrees = degrees > 180 ? degrees - 360 : degrees
  return Math.abs(signedDegrees) < 0.05 ? 0 : +signedDegrees.toFixed(1)
}
```

否则 Element Plus 的 `[-180°, 180°]` 滑块会将越界的回读值钳制，表现为 Roll 跳到 `180°`、拖动负 Roll 时混乱。

### 为什么 UI 不直接使用 `[0°, 360°]`

这是交互语义选择，不是 Cesium 兼容性限制。UI 保持有符号范围：负值表示向左滚转，正值表示向右滚转；例如 `-90°` 比等价的 `270°` 更容易理解。`180°` 和 `-180°` 都表示倒置姿态。

如果页面要展示 Cesium 原始 API 值，可使用 `[0°, 360°]`；但姿态控制滑块应保持 `[-180°, 180°]`，并仅在 Cesium → UI 的同步边界执行上述转换。

## 避开近垂直 Pitch：实际阈值约为 ±87.4°

Cesium 在相机视线接近局部竖直轴时，Heading 与 Roll 不再能被唯一分解：`camera.heading` 会改用 `up` 向量推导，而 `camera.roll` 直接回读为 `0°`。此时拖动 Roll 会带动 Heading，顶视下两者也会看起来都在旋转地图。

Cesium `1.142.0` 以 `abs(direction.z)` 与 `1.0` 的 `EPSILON3 = 0.001` 比较决定是否进入这个分支。因为 `direction.z = sin(pitch)`，边界约为：

```text
abs(sin(pitch)) >= 0.999  →  abs(pitch) >= 87.44°
```

所以 `±89.9°` 当然会退化，但并不是起点；`±87°` 是刻意留出约 `0.44°` 的安全余量。不要把滑块上限放到 `±90°`，也不要把 `camera.pitch` 的回读值直接当成始终可独立编辑的欧拉角。

滑块的 `min/max` 只限制面板输入，不能限制鼠标地图操作、`flyTo` 或其他模块调用 `setView`。若产品要求始终避免退化区，必须把约束放到统一的相机控制策略中；若允许这些外部操作，则在 `abs(pitch) >= 87.4°` 时应将 HPR 面板降级为只读提示或禁用独立 Roll 编辑。不要为了把滑块拉回范围而在 `camera.changed` 中立刻写回相机，这会制造新的跳变。

### 演示语义与安全范围是两回事

`[-87°, 87°]` 只是在避免 Cesium 的退化分支。若默认 Pitch 恰好为 `-87°`，镜头仍接近俯视，Heading 与 Roll 的视觉效果会很相似；这不表示两者相同。

若页面重点是教学演示 Heading 与 Roll 的区别，默认和重置 Pitch 应使用离垂直更远的值，例如 `-45°` 或 `-60°`；若页面重点是展示接近俯视的地球，则可以保留 `-87°`，但应明确提示两种旋转在该视角下不易区分。

在非近垂直 Pitch 下：

- Heading 改变相机视线方向；
- Roll 保持视线方向，仅绕视线轴倾斜画面。

### 同步方向不能形成反馈环

- UI 拖动：将滑块值写入 `camera.setView({ orientation })`。
- 用户拖拽地图或程序飞行：从 `camera.changed` 回读相机值，更新 UI。
- 相机回读更新 UI 时，不能再次触发写回相机；否则浮点归一化、Roll 的符号转换和滑块步长会相互放大，表现为抖动或跳变。

当前页面使用 `@update:modelValue` 处理真实滑块输入；Vue 对 `ref` 的程序化赋值不会再次发出该事件。以后若改为 `watch` 写回相机，必须增加来源标识或同步锁。

## HPR 的输入与回读范围要分开理解

| 角度 | `camera` 回读值 | 本页 UI 编辑范围 | 说明 |
| --- | --- | --- | --- |
| Heading | `[0°, 360°]` | `[0°, 360°]` | `0°` 与 `360°` 等价。 |
| Pitch | `[-90°, 90°]` | `[-87°, 87°]` | UI 主动避开近垂直退化区。 |
| Roll | `[0°, 360°]` | `[-180°, 180°]` | UI 通过 `toSignedRollDegrees` 转为有符号读法。 |

表中的回读范围是 Cesium 规范化后的 getter 结果；`setView` 的 `orientation` 参数是弧度输入，不应把 UI 范围误解为 API 对传入数值的强制校验范围。

## 更新姿态时不重设位置

仅修改姿态时不要传入 `destination: camera.position`。`setView` 未传 `destination` 时会保持相机的世界坐标位置：

```ts
camera.setView({
  orientation: { heading, pitch, roll },
})
```
