<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="(v: boolean) => panelOpen = v" />
    </div>

    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">

        <!-- ════════════ 卡片一：ScreenSpaceEventHandler — 鼠标事件 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🖱️ ScreenSpaceEventHandler — 鼠标事件</template>

          <div class="event-item">
            <div class="event-head">
              <!-- v 是 el-switch 组件开关切换后的状态，true 或 false。 -->
              <el-switch :model-value="mouseEnabled.LEFT_CLICK" size="small"
                @update:model-value="(v: boolean) => toggleMouse('LEFT_CLICK', v)" />
              <span class="evt-name">LEFT_CLICK</span>
              <span class="evt-desc">点击地图 → 获取点击位置的坐标</span>
            </div>
            <div v-if="clickResult" class="evt-result">
              屏幕像素位置 ({{ clickResult.screenX }}, {{ clickResult.screenY }})<br>
              经纬度 {{ clickResult.lon }}, {{ clickResult.lat }}
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="mouseEnabled.LEFT_DOUBLE_CLICK" size="small"
                @update:model-value="(v: boolean) => toggleMouse('LEFT_DOUBLE_CLICK', v)" />
              <span class="evt-name">LEFT_DOUBLE_CLICK</span>
              <span class="evt-desc">双击地图 → 相机飞入至点击位置</span>
            </div>
            <div v-if="dblClickMsg" class="evt-result">→ {{ dblClickMsg }}</div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="mouseEnabled.RIGHT_CLICK" size="small"
                @update:model-value="(v: boolean) => toggleMouse('RIGHT_CLICK', v)" />
              <span class="evt-name">RIGHT_CLICK</span>
              <span class="evt-desc">右键点击地图 → 触发右键事件</span>
            </div>
            <div v-if="rightClickMsg" class="evt-result">屏幕像素位置 {{ rightClickMsg }}</div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="mouseEnabled.MOUSE_MOVE" size="small"
                @update:model-value="(v: boolean) => toggleMouse('MOUSE_MOVE', v)" />
              <span class="evt-name">MOUSE_MOVE</span>
              <span class="evt-desc">移动鼠标 → 实时获取光标下的经纬度</span>
            </div>
            <div v-if="moveCoord" class="evt-result">
              屏幕像素位置 ({{ moveCoord.screenX }}, {{ moveCoord.screenY }})<br>
              经纬度 {{ moveCoord.lon }}, {{ moveCoord.lat }}
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="mouseEnabled.WHEEL" size="small"
                @update:model-value="(v: boolean) => toggleMouse('WHEEL', v)" />
              <span class="evt-name">WHEEL</span>
              <span class="evt-desc">滚动滚轮 → 识别缩放方向和幅度</span>
            </div>
            <div v-if="wheelMsg" class="evt-result">→ {{ wheelMsg }}</div>
          </div>
        </el-card>

        <!-- ════════════ 卡片二：Camera 事件 — addEventListener ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>📷 Camera 事件 — <code>addEventListener</code></template>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="cameraEnabled.moveStart" size="small"
                @update:model-value="(v: boolean) => toggleCamera('moveStart', v)" />
              <span class="evt-name">moveStart</span>
              <span class="evt-desc">相机开始移动时触发</span>
              <span class="evt-count">移动次数：{{ cameraCount.moveStart }}</span>
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="cameraEnabled.moveEnd" size="small"
                @update:model-value="(v: boolean) => toggleCamera('moveEnd', v)" />
              <span class="evt-name">moveEnd</span>
              <span class="evt-desc">相机停止移动时触发</span>
              <span class="evt-count">移动次数：{{ cameraCount.moveEnd }}</span>
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="cameraEnabled.changed" size="small"
                @update:model-value="(v: boolean) => toggleCamera('changed', v)" />
              <span class="evt-name">changed</span>
              <span class="evt-desc">相机位置或姿态变化时触发</span>
              <span class="evt-alt">高度：{{ cameraAlt.toFixed(1) }} km</span>
              <span class="evt-count">{{ cameraCount.changed }}</span>
            </div>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：Scene & Clock 事件 — addEventListener ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>⏱️ Scene &amp; Clock 事件 — <code>addEventListener</code></template>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="sceneEnabled.postRender" size="small"
                @update:model-value="(v: boolean) => toggleScene('postRender', v)" />
              <span class="evt-name">postRender</span>
              <span class="evt-desc">每帧渲染完成后触发</span>
              <span class="evt-display">共完成：{{ frameCount }} 帧</span>
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="sceneEnabled.preRender" size="small"
                @update:model-value="(v: boolean) => toggleScene('preRender', v)" />
              <span class="evt-name">preRender</span>
              <span class="evt-desc">每帧渲染开始前触发</span>
              <span class="evt-display">耗时：{{ preRenderDelta }} ms</span>
            </div>
          </div>

          <div class="event-item">
            <div class="event-head">
              <el-switch :model-value="sceneEnabled.onTick" size="small"
                @update:model-value="(v: boolean) => toggleScene('onTick', v)" />
              <span class="evt-name">onTick</span>
              <span class="evt-desc">仿真时钟每跳动一次触发</span>
              <span class="evt-display">{{ simTime }}</span>
            </div>
          </div>
        </el-card>

      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartesian3,
  Cartographic,
  JulianDate,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Math as CesiumMath,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── 类型 ──
interface ClickResult {
  screenX: number; screenY: number
  lon: string; lat: string
}
interface MoveCoord {
  screenX: number; screenY: number
  lon: string; lat: string
}

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let handler: ScreenSpaceEventHandler | null = null

// ── Mouse 事件（卡片一） ──
const mouseEnabled = reactive<Record<string, boolean>>({
  LEFT_CLICK: true,
  LEFT_DOUBLE_CLICK: false,
  RIGHT_CLICK: false,
  MOUSE_MOVE: false,
  WHEEL: false,
})
const clickResult = ref<ClickResult | null>(null)
const dblClickMsg = ref("")
const rightClickMsg = ref("")
const moveCoord = ref<MoveCoord | null>(null)
const wheelMsg = ref("")

// ── Camera 事件（卡片二） ──
const cameraEnabled = reactive<Record<string, boolean>>({ moveStart: false, moveEnd: false, changed: false })
const cameraCount = reactive<Record<string, number>>({ moveStart: 0, moveEnd: 0, changed: 0 })
const cameraAlt = ref(0) // 相机高度

const cameraRemoveFns: Record<string, (() => void) | null> = {
  moveStart: null, moveEnd: null, changed: null,
}

// ── Scene & Clock 事件（卡片三） ──
const sceneEnabled = reactive<Record<string, boolean>>({ postRender: false, preRender: false, onTick: false })
const frameCount = ref(0)
const preRenderDelta = ref("—")
const simTime = ref("—")

const sceneRemoveFns: Record<string, (() => void) | null> = {
  postRender: null, preRender: null, onTick: null,
}

let lastPreRenderTime = 0

// ── 工具 ──
function cartographicStr(pos: Cartesian3): { lon: string; lat: string; alt: string } | null {
  try {
    const c = Cartographic.fromCartesian(pos)
    const h = Math.round(c.height) // round表示四舍五入，避免 -0
    return {
      lon: `${CesiumMath.toDegrees(c.longitude).toFixed(4)}°`,
      lat: `${CesiumMath.toDegrees(c.latitude).toFixed(4)}°`,
      alt: `${h < 0 ? h : h || 0} m`,  // 但其实pickEllipsoid返回的高度永远是0，他获得的是椭球体表面坐标。
    }
  } catch { return null }
}

// ══════════════════════════════════════════
// ScreenSpaceEventHandler 开关
// ══════════════════════════════════════════

function toggleMouse(type: string, on: boolean) {
  if (!handler) return
  if (on) {
    switch (type) {
      case "LEFT_CLICK": handler.setInputAction(onLeftClick, ScreenSpaceEventType.LEFT_CLICK); break
      case "LEFT_DOUBLE_CLICK": handler.setInputAction(onDblClick, ScreenSpaceEventType.LEFT_DOUBLE_CLICK); break
      case "RIGHT_CLICK": handler.setInputAction(onRightClick, ScreenSpaceEventType.RIGHT_CLICK); break
      case "MOUSE_MOVE": handler.setInputAction(onMouseMove, ScreenSpaceEventType.MOUSE_MOVE); break
      case "WHEEL": handler.setInputAction(onWheel, ScreenSpaceEventType.WHEEL); break
    }
  } else {
    // as keyof typeof ScreenSpaceEventType 是为了让 TypeScript 知道 type 是 ScreenSpaceEventType 的键名
    handler.removeInputAction(ScreenSpaceEventType[type as keyof typeof ScreenSpaceEventType])
  }
  mouseEnabled[type] = on
}

function onLeftClick(click: any) {
  if (!viewer) return
  const p = click.position
  // 通过屏幕像素位置获取地球椭球体上的笛卡尔坐标
  const c = viewer.camera.pickEllipsoid(p)
  if (c) {
    const s = cartographicStr(c)
    if (s) clickResult.value = { screenX: Math.round(p.x), screenY: Math.round(p.y), lon: s.lon, lat: s.lat }
  }
}

function onDblClick(click: any) {
  if (!viewer) return
  // 通过屏幕像素位置获取地球椭球体上的笛卡尔坐标
  const c = viewer.camera.pickEllipsoid(click.position)
  if (c) {
    const carto = Cartographic.fromCartesian(c)
    // Cartographic 已经是弧度，直接 fromRadians 即可，不需要先 toDegrees 再转回来
    // c也是笛卡尔，dest加了高度。
    const dest = Cartesian3.fromRadians(carto.longitude, carto.latitude, 500000)
    // Cesium 相机 API 全部使用弧度（radian）而非角度（degree），所以不能直接写 -90
    // 弧度 = 角度 × π / 180，-90° = -π/2 ≈ -1.5708 rad
    // 这是 3D 引擎惯例——三角函数（sin/cos）原生接受弧度，GPU 数学库也统一用弧度
    // CesiumMath 提供了 toRadians(deg) / toDegrees(rad) 做转换
    //
    // destination 是位置 → Cartesian3（三维空间坐标，单位米）
    // orientation 是姿态 → heading/pitch/roll 用弧度
    // 两者量的东西不同，所以单位不同是合理的
    viewer.camera.flyTo({
      destination: dest,
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.2,
    })
    dblClickMsg.value = `已飞至 ${CesiumMath.toDegrees(carto.longitude).toFixed(4)}°, ${CesiumMath.toDegrees(carto.latitude).toFixed(4)}°`
  }
}

function onRightClick(click: any) {
  rightClickMsg.value = `(${Math.round(click.position.x)}, ${Math.round(click.position.y)})`
}

let moveLastTime = 0
function onMouseMove(click: any) {
  const now = Date.now()
  // 限制频率，避免频繁更新，80ms 内只处理一次
  if (now - moveLastTime < 80) return 
  moveLastTime = now
  if (!viewer) return
  const p = click.endPosition
  const c = viewer.camera.pickEllipsoid(p)
  if (c) {
    const s = cartographicStr(c)
    if (s) moveCoord.value = { screenX: Math.round(p.x), screenY: Math.round(p.y), lon: s.lon, lat: s.lat }
  }
}

// delta > 0 表示向上滚动，delta < 0 表示向下滚动
function onWheel(delta: number) {
  if (!viewer) return
  const altKm = (viewer.camera.positionCartographic.height / 1000).toFixed(0)
  wheelMsg.value = `${delta > 0 ? "🔺放大" : "🔻缩小"}  高 ${altKm} km`
}

// ══════════════════════════════════════════
// Camera 事件 开关
// ══════════════════════════════════════════

function toggleCamera(name: string, on: boolean) {
  if (!viewer) return
  if (on) {
    let removeFn: (() => void) | null = null
    switch (name) {
      case "moveStart":
        removeFn = viewer.camera.moveStart.addEventListener(() => {
          cameraCount.moveStart++
        })
        break
      case "moveEnd":
        removeFn = viewer.camera.moveEnd.addEventListener(() => {
          cameraCount.moveEnd++
        })
        break
      case "changed": {
        let lastTime = 0
        removeFn = viewer.camera.changed.addEventListener(() => {
          const now = Date.now()
          if (now - lastTime < 150) return
          lastTime = now
          if (!viewer) return
          cameraAlt.value = viewer.camera.positionCartographic.height / 1000
          cameraCount.changed++
        })
        break
      }
    }
    cameraRemoveFns[name] = removeFn // 保存移除函数，方便后续关闭事件监听
    cameraCount[name] = 0 // 初始化计数
  } else {
    // 关闭开关时：
    cameraRemoveFns[name]?.()   // 调用移除函数 → 取消订阅
    cameraRemoveFns[name] = null // 清空引用，防止被二次调用
  }
  cameraEnabled[name] = on
}

// ══════════════════════════════════════════
// Scene / Clock 事件 开关
// ══════════════════════════════════════════

function toggleScene(name: string, on: boolean) {
  if (!viewer) return
  if (on) {
    let removeFn: (() => void) | null = null
    switch (name) {
      case "postRender":
        frameCount.value = 0
        removeFn = viewer.scene.postRender.addEventListener(() => { frameCount.value++ })
        break
      case "preRender":
        // 初始化上一次预渲染时间为0
        lastPreRenderTime = 0
        // 移除函数，用于存储事件监听器的引用，以便后续可以移除
        removeFn = viewer.scene.preRender.addEventListener(() => {
          // 获取当前时间戳（毫秒级）
          const t = performance.now()
          // 如果上一次预渲染时间不为0，则计算并更新预渲染时间差
          if (lastPreRenderTime) preRenderDelta.value = `Δ ${(t - lastPreRenderTime).toFixed(1)} ms`
          // 更新上一次预渲染时间为当前时间
          lastPreRenderTime = t
        })
        break
      case "onTick":
        // onTick 的触发频率由帧率决定，每渲染一帧就 tick 一次（通常 ~60 次/秒）。
        removeFn = viewer.clock.onTick.addEventListener(() => {
          if (!viewer) return
          // 将viewer.clock.currentTime转换为Date对象
          const d = JulianDate.toDate(viewer.clock.currentTime)
          // 将日期转换为ISO格式字符串，并替换"T"为空格，截取前19个字符（去除毫秒）
          simTime.value = d.toISOString().replace("T", " ").slice(0, 19)
        })
        break
    }
    sceneRemoveFns[name] = removeFn
  } else {
    sceneRemoveFns[name]?.()  // 取消订阅
    sceneRemoveFns[name] = null
  }
  sceneEnabled[name] = on
}

// ══════════════════════════════════════════
// 底图切换
// ══════════════════════════════════════════

async function switchBasemap(item: CesiumBasemapItem) {
  if (item.id === currentId.value || !viewer) return
  try {
    await item.activate(viewer)
    currentId.value = item.id
    currentLabel.value = item.label
  } catch (e: any) {
    ElMessage.error(`底图切换失败: ${e.message}`)
  }
}

// ══════════════════════════════════════════
// 生命周期
// ══════════════════════════════════════════

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN

  viewer = new Viewer("cesiumContainer", {
    baseLayer: false,
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    homeButton: false,
    projectionPicker: false,
  })

  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "mars3d-terrain")!
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 20000000),
    // heading/pitch/roll 用弧度，不能用度数。-90° 俯仰 = 垂直向下正射视角
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })

  cameraAlt.value = viewer.camera.positionCartographic.height / 1000

  // 启用手动画时钟（animation/timeline 隐藏后时钟默认暂停）
  viewer.clock.shouldAnimate = true
  // JulianDate是Cesium的时间对象，JulianDate.now()返回当前时间。
  viewer.clock.currentTime = JulianDate.now()

  // viewer.scene.canvas是一个HTMLCanvasElement对象，表示Cesium的渲染画布
  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  // 默认启用左键点击事件
  toggleMouse("LEFT_CLICK", true)
})

onUnmounted(() => {
  if (handler) { handler.destroy(); handler = null }
  Object.values(cameraRemoveFns).forEach(fn => fn?.()) // 销毁相机事件监听
  Object.values(sceneRemoveFns).forEach(fn => fn?.()) // 销毁场景事件监听
  if (viewer) { viewer.destroy(); viewer = null }
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

:deep(.cesium-viewer-bottom) {
  display: none !important;
}

:deep(.cesium-viewer-toolbar) {
  display: none !important;
}

.top-right-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.basemap-label {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 100;
  color: #fff;
  background: rgba(0, 0, 0, .55);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  pointer-events: none;
}

/* ── 左侧面板 ── */
.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 360px;
}

.panel-card {
  --el-card-padding: 12px;
  --el-card-border-radius: 8px;
  margin-bottom: 8px;
}

.panel-card :deep(.el-card__header) {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
}

.panel-card :deep(.el-card__body) {
  padding: 10px 14px;
}

/* ── 事件条目 ── */
.event-item {
  padding: 6px 0;
  border-bottom: 1px solid var(--el-border-color-extra-light);
}

.event-item:last-child {
  border-bottom: none;
}

.event-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.evt-name {
  font-weight: 600;
  font-size: 12px;
  white-space: nowrap;
  color: var(--el-text-color-primary);
}

.evt-desc {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.evt-result {
  font-size: 11px;
  color: var(--el-color-primary);
  font-family: monospace;
  padding: 4px 0 0 38px;
}

.evt-count {
  font-size: 11px;
  font-family: monospace;
  color: var(--el-color-primary);
  min-width: 24px;
  text-align: right;
}

.evt-alt {
  font-size: 11px;
  font-family: monospace;
  color: var(--el-color-warning);
  white-space: nowrap;
}

.evt-display {
  font-size: 11px;
  font-family: monospace;
  color: var(--el-color-primary);
  white-space: nowrap;
}
</style>
