<template>
  <div class="map-container">
    <div id="cesiumPerformanceLifecycle" class="cesium-canvas" />

    <!-- 复用前序课程的底图入口；切换影像不影响本页登记的事件、计时器与 Entity 生命周期。 -->
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />
    <div class="map-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="panelOpen = $event" />
    </div>
    <div class="basemap-label">{{ currentLabel || "加载中..." }}</div>

    <aside class="left-panel">
      <el-card shadow="never" class="panel-card">
        <template #header>17 · 性能优化与资源生命周期</template>
        <p class="card-desc">这一课讲整个前端场景的渲染与销毁治理；3D Tiles LOD、内存和 FPS 参数不在这里重复。</p>
        <div class="switch-row">
          <span>按需渲染 <code>requestRenderMode</code></span>
          <el-switch :model-value="requestRenderMode" @update:model-value="setRequestRenderMode" />
        </div>
        <div class="switch-row">
          <span>模拟 250ms 实时数据更新</span>
          <el-switch :model-value="dynamicUpdatesEnabled" @update:model-value="setDynamicUpdates" />
        </div>
        <el-button size="small" type="primary" :loading="asyncPending"
          @click="simulateExternalUpdate">模拟异步外部更新
        </el-button>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>渲染观察</template>
        <div class="metrics-grid">
          <div><span>已观察帧数</span><strong>{{ renderedFrames }}</strong></div>
          <div><span>最近采样 FPS</span><strong>{{ framesPerSecond }}</strong></div>
          <div><span>外部状态版本</span><strong>{{ externalValue }}</strong></div>
        </div>
        <p class="card-desc">静止的按需渲染场景不会持续增长；操作控件或数据到达后，通过 <code>scene.requestRender()</code> 生成所需的新帧。</p>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>资源释放顺序</template>
        <ol class="lifecycle-list">
          <li>停止计时器并取消异步结果写回。</li>
          <li>注销 <code>postRender</code> 与鼠标事件。</li>
          <li>移除临时场景对象。</li>
          <li>最后销毁 <code>Viewer</code>。</li>
        </ol>
        <p class="status-box">{{ lastAction }}</p>
      </el-card>
    </aside>
  </div>
</template>

<script lang="ts">
export type Dispose = () => void

export interface Disposables {
  add: (dispose: Dispose) => void
  dispose: () => void
}

/**
 * 用于把“创建资源”与“释放资源”放在同一页内管理。
 * 逆序释放与函数调用栈相同：后创建的 handler、定时器要在 Viewer 销毁前先停掉。
 * 登记顺序：Viewer → postRender → 鼠标事件 → 定时器
 * 释放顺序：定时器 → 鼠标事件 → postRender → Viewer   ← 后创建的先释放
 */
export function createDisposables(): Disposables {
  let disposed = false
  const callbacks: Dispose[] = []

  return {
    add(dispose) {
      // 异步加载完成得比路由卸载更晚时，不能把资源留在已关闭的页面上。
      if (disposed) dispose()
      else callbacks.push(dispose)
    },
    dispose() {
      if (disposed) return
      disposed = true
      while (callbacks.length) {
        try {
          callbacks.pop()?.()
        } catch (error) {
          // 一个资源清理失败也不应阻断后续资源释放。
          console.error("Cesium 资源清理失败", error)
        }
      }
    },
  }
}
</script>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { ElMessage } from "element-plus"
import {
  Cartesian2,
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  type Entity,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

// 按需渲染开关，页面默认开启。切换时同步到 viewer.scene.requestRenderMode 与 maximumRenderTimeChange。
const requestRenderMode = ref(true)
// 累计渲染帧数。页面挂载以来一共画了多少帧，只增不减
const renderedFrames = ref(0)
// 最近半秒的帧率。滑动窗口测量，每 500ms 刷新一次。
const framesPerSecond = ref(0)
// 模拟 250ms 实时数据更新的开关。开时启动 dynamicTimer，关时停止。
const dynamicUpdatesEnabled = ref(false)
// 外部状态版本号，每次“模拟异步外部更新”回调成功写回时 +1。
const externalValue = ref(0)
// 异步更新进行中标记。请求发出后置 true（按钮转圈），回调返回后置 false。
const asyncPending = ref(false)
// 操作状态文本，展示在“资源释放顺序”卡片下方的状态框里。
const lastAction = ref("等待交互")
// 底图切换器浮层（panel-overlay）是否展开。
const panelOpen = ref(false)
// 当前底图 id / 名称，用于底图切换器高亮和右上角标签展示。
const currentId = ref("")
const currentLabel = ref("")

let viewer: Viewer | null = null
let handler: ScreenSpaceEventHandler | null = null
let disposables = createDisposables()
// 页面存活标记：路由卸载后置 false，异步回调据此放弃写回已销毁的 Viewer。
let pageActive = false
// setInterval 句柄：模拟每 250ms 到达一次的实时数据，更新 dynamicEntity 的位置。
let dynamicTimer: number | undefined
// setTimeout 句柄：模拟异步外部更新，800ms 后写回 externalValue 并添加临时标记。
let asyncTimer: number | undefined
// setTimeout 句柄：临时反馈 Entity 的自动移除倒计时（1.6s 后执行 removeTransientEntity）。
let transientTimer: number | undefined
// 临时反馈 Entity：模拟异步外部更新落地的可见标记，1.6s 后自动移除，避免永久堆积。
let transientEntity: Entity | undefined
// 受控动态对象：随 dynamicPhase 绕小圈运动的绿色标记，展示实时数据如何驱动场景。
let dynamicEntity: Entity | undefined
// 动态对象的运动相位角，每 250ms 递增，计算下一次位置时使用。
let dynamicPhase = 0

// requestRender() 是"请求渲染"，不等于"恰好只画一帧"。
// 它只是把 _renderRequested 置 true，这一帧画完后可能引发连锁的更多帧。
function requestSceneRender() {
  // requestRenderMode 仅决定“什么时候允许画新帧”，不会自动追踪 Vue ref。
  // 所有页面外部状态写回 Cesium 后都应显式请求一次，这也是企业项目的统一入口。
  viewer?.scene.requestRender()
}

/**
 * 底图激活只替换 imageryLayers，不进入本页的 Disposables 注册表。
 * 计时器、事件与临时 Entity 仍按本课定义的逆序生命周期释放。
 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return
  try {
    await item.activate(viewer)
    if (!pageActive || !viewer || viewer.isDestroyed()) return
    currentId.value = item.id
    currentLabel.value = item.label
    requestSceneRender()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`底图切换失败：${message}`)
  }
}

function stopDynamicUpdates() {
  if (dynamicTimer !== undefined) window.clearInterval(dynamicTimer)
  dynamicTimer = undefined
}

function cancelAsyncUpdate() {
  if (asyncTimer !== undefined) window.clearTimeout(asyncTimer)
  asyncTimer = undefined
  asyncPending.value = false
}

function removeTransientEntity() {
  if (viewer && transientEntity) viewer.entities.remove(transientEntity)
  transientEntity = undefined
  if (transientTimer !== undefined) window.clearTimeout(transientTimer)
  transientTimer = undefined
}

function setRequestRenderMode(value: boolean) {
  requestRenderMode.value = value
  if (!viewer) return
  // 只设 requestRenderMode = true 不够，必须配合抬高 maximumRenderTimeChange
  viewer.scene.requestRenderMode = value
  // maximumRenderTimeChange 是 "距上次真正画帧过去了多少秒"的阈值。超过它就强制重绘一帧。
  // Number.POSITIVE_INFINITY：静止场景完全休眠，只有 requestRender()、相机移动等才画帧
  // 0（连续渲染开）是最常用的两种配置。任何一点点时间流逝（> 0）都强制重绘 → 每帧都画
  viewer.scene.maximumRenderTimeChange = value ? Number.POSITIVE_INFINITY : 0
  lastAction.value = value ? "已启用按需渲染" : "已切换为连续渲染"
  requestSceneRender()
}

function setDynamicUpdates(value: boolean) {
  // 同步开关状态到 ref，供 UI 绑定和其他逻辑使用
  dynamicUpdatesEnabled.value = value
  // 停止现有的动态更新定时器
  stopDynamicUpdates()
  // 若为开启按钮、Viewer 未创建或动态实体未创建，则不启动定时器，避免报错。
  if (!value || !viewer || !dynamicEntity) {
    requestSceneRender()
    return
  }

  // 模拟每 250ms 到达一次的实时数据。真实业务应按数据实际频率更新，
  // 而不是为了“动起来”在 requestAnimationFrame 中无条件写 Entity。
  dynamicTimer = window.setInterval(() => {
    // 检查页面是否激活、查看器对象和动态实体对象是否存在，如果任一条件不存在则直接返回
    if (!pageActive || !viewer || !dynamicEntity) return
    // dynamicPhase 是一个弧度值，每次更新时增加 0.18 弧度，约 10°。
    // 控制动态实体的位置沿着一个小圆形轨迹移动
    dynamicPhase += 0.18
    dynamicEntity.position = new ConstantPositionProperty(Cartesian3.fromDegrees(
      116.39 + Math.cos(dynamicPhase) * 0.008,
      39.905 + Math.sin(dynamicPhase) * 0.005,
      80,
    ))
    lastAction.value = "实时位置已更新并请求渲染"
    requestSceneRender()
  }, 250)
  requestSceneRender()
}

function simulateExternalUpdate() {
  cancelAsyncUpdate()
  asyncPending.value = true
  lastAction.value = "模拟异步结果将在 800ms 后返回"
  requestSceneRender()

  asyncTimer = window.setTimeout(() => {
    asyncTimer = undefined
    // 回调可能发生在路由卸载后。先检查存活状态，避免“已销毁 Viewer 仍被写入”。
    if (!pageActive || !viewer) return
    externalValue.value += 1
    asyncPending.value = false
    lastAction.value = `外部状态 #${externalValue.value} 已写回场景`
    addTransientMarker()
    requestSceneRender()
  }, 800)
}

function addTransientMarker() {
  if (!viewer) return
  removeTransientEntity()
  transientEntity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.39, 39.905, 100),
    point: { pixelSize: 16, color: Color.fromCssColorString("#f5222d"), outlineColor: Color.WHITE, outlineWidth: 2 },
    label: {
      text: `外部更新 #${externalValue.value}`,
      font: "13px sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      pixelOffset: new Cartesian2(0, -24),
    },
  })
  // 临时反馈对象也应有确定的退出路径，不应在每次操作后永久堆积。
  transientTimer = window.setTimeout(() => {
    removeTransientEntity()
    requestSceneRender()
  }, 1_600)
}

onMounted(() => {
  pageActive = true
  // disposables 是一个"资源登记表"：创建资源时把"怎么销毁它"登记进去，页面卸载时统一执行。
  // 创建资源时 —— 每个创建点自己登记
  // disposables.add(() => { viewer.destroy() }) // 登记"销毁 Viewer"的方法
  // disposables.add(removePostRender)           // 登记"注销 postRender"
  // disposables.add(stopDynamicUpdates)         // 登记"停掉定时器"
  // 卸载时 —— 只调一行，其余自动处理
  // onUnmounted(() => { disposables.dispose() })
  disposables = createDisposables()
  viewer = new Viewer("cesiumPerformanceLifecycle", {
    baseLayer: false,
    animation: false,
    timeline: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
  })
  // 性能页也使用真实瓦片底图，避免单张世界图在局部镜头下缺少空间细节。
  const defaultBasemap = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  void switchBasemap(defaultBasemap)
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.39, 39.905, 20_000) })

  // Disposable 是后进先出；Viewer 必须最早登记，才能最后销毁。
  // 后面登记的事件、计时器和临时对象会先释放，不会再访问已销毁的场景。
  disposables.add(() => {
    if (viewer && !viewer.isDestroyed()) viewer.destroy()
    viewer = null
  })

  dynamicEntity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.398, 39.905, 80),
    point: { pixelSize: 13, color: Color.fromCssColorString("#00b96b"), outlineColor: Color.WHITE, outlineWidth: 2 },
    label: {
      text: "受控动态对象",
      font: "13px sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      pixelOffset: new Cartesian2(0, -24),
    },
  })

  let framesSinceSample = 0
  let sampleStartedAt = performance.now()
  // postRender 是"一帧已经画完"的回调 —— 每一帧触发一次，是天然的帧计数器。
  const removePostRender = viewer.scene.postRender.addEventListener(() => {
    // postRender 是“已经画完一帧”的观察点，不是触发下一帧的地方。
    // 用半秒采样一次，避免连续渲染时把每帧统计又变成新的 Vue 更新压力。
    framesSinceSample += 1
    const now = performance.now()
    if (now - sampleStartedAt < 500) return
    renderedFrames.value += framesSinceSample
    // 窗口内帧数 × 1000 ÷ 窗口实际耗时(ms) → 折算成"每秒多少帧"
    framesPerSecond.value = Math.round((framesSinceSample * 1_000) / (now - sampleStartedAt))
    framesSinceSample = 0
    sampleStartedAt = now
  })
  disposables.add(removePostRender)

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(() => {
    lastAction.value = "鼠标事件已处理；事件本身也会在卸载时销毁"
    requestSceneRender()
  }, ScreenSpaceEventType.LEFT_CLICK)
  
  disposables.add(() => {
    if (handler && !handler.isDestroyed()) handler.destroy()
    handler = null
  })

  // 下列资源在 Viewer 之后登记，因此 dispose 逆序执行时会先停止它们。
  disposables.add(stopDynamicUpdates)
  disposables.add(cancelAsyncUpdate)
  disposables.add(removeTransientEntity)

  setRequestRenderMode(true)
})

onUnmounted(() => {
  pageActive = false
  dynamicUpdatesEnabled.value = false
  disposables.dispose()
})
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.cesium-canvas {
  width: 100%;
  height: 100%;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.basemap-label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 100;
  padding: 3px 10px;
  color: var(--el-color-white);
  font-size: 12px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  pointer-events: none;
}

.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  width: min(390px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  overflow-y: auto;
}

.panel-card {
  margin-bottom: 9px;
}

.panel-card :deep(.el-card__header) {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
}

.panel-card :deep(.el-card__body) {
  padding: 12px;
}

.card-desc {
  margin: 0 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.switch-row:last-of-type {
  margin-bottom: 10px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.metrics-grid div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.metrics-grid span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.metrics-grid strong {
  color: var(--el-color-primary);
  font-size: 18px;
}

.lifecycle-list {
  padding-left: 20px;
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.8;
}

.status-box {
  margin: 10px 0 0;
  padding: 7px 9px;
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 1.55;
  background: var(--el-color-primary-light-9);
  border-radius: 5px;
}

@media (max-width: 640px) {
  .left-panel {
    width: calc(100% - 24px);
    max-height: 56%;
  }
}
</style>
