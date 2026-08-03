<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="(v: boolean) => panelOpen = v" />
    </div>

    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">

        <!-- ════════════ 卡片一：飞行路径 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>✈️ 飞行路径 — <code>SampledPositionProperty</code></template>

          <p class="card-desc">
            手动构造位置采样时间序列，配合 <code>VelocityOrientationProperty</code>
            自动计算姿态，模型沿路径飞行。
          </p>

          <div class="select-row">
            <label class="sel-label">模型</label>
            <el-radio-group v-model="selectedModel" size="small">
              <el-radio-button value="feiji">客机</el-radio-button>
              <el-radio-button value="missile">导弹</el-radio-button>
              <el-radio-button value="dji">无人机</el-radio-button>
            </el-radio-group>
          </div>

          <div class="select-row">
            <label class="sel-label">路径</label>
            <el-radio-group v-model="selectedPath" size="small">
              <el-radio-button value="beijing">北京环飞</el-radio-button>
              <el-radio-button value="straight">直线往返</el-radio-button>
            </el-radio-group>
          </div>

          <div class="button-row">
            <el-button size="small" type="primary" :disabled="hasAnimation" @click="startAnimation">
              🚀 创建
            </el-button>
            <el-button size="small" type="danger" plain :disabled="!hasAnimation" @click="clearAnimation">
              清除
            </el-button>
          </div>

          <div v-if="animInfo" class="info-box">{{ animInfo }}</div>
        </el-card>

        <!-- ════════════ 卡片二：时间控制 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>⏱️ 时间控制 — <code>Clock</code></template>

          <p class="card-desc">
            使用 Cesium 仿真时钟驱动动画。调整速度、拖拽进度条，
            可通过 Timeline 控件精确控制播放位置。
          </p>

          <!-- 播放/暂停 -->
          <div class="play-row">
            <el-button size="small" :type="isPlaying ? 'warning' : 'success'" :disabled="!hasAnimation"
              @click="togglePlay">
              {{ isPlaying ? '⏸ 暂停' : '▶ 播放' }}
            </el-button>
            <el-button size="small" :disabled="!hasAnimation" @click="resetAnimation">
              ⏹ 重置
            </el-button>
          </div>

          <!-- 速度 -->
          <div class="speed-row">
            <span class="speed-label">速度</span>
            <div class="speed-btns">
              <el-button v-for="s in speedOptions" :key="s" size="small" :type="speed === s ? 'primary' : ''"
                :disabled="!hasAnimation" @click="setSpeed(s)">
                {{ s }}×
              </el-button>
            </div>
          </div>

          <!-- 进度条 -->
          <div class="progress-row">
            <span class="progress-label">进度</span>
            <el-slider v-model="progress" :disabled="!hasAnimation" :format-tooltip="formatProgress"
              @update:model-value="onSeek" />
          </div>

          <!-- 时间显示 -->
          <div v-if="hasAnimation" class="time-display">
            <span class="time-elapsed">{{ elapsedStr }}</span>
            <span class="time-sep">/</span>
            <span class="time-total">{{ totalStr }}</span>
            <span class="time-clock">🕐 {{ simTimeStr }}</span>
          </div>
          <div v-else class="card-hint">点击「创建」开始动画</div>
        </el-card>

        <!-- ════════════ 卡片三：相机模式 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>📷 相机模式</template>

          <p class="card-desc">
            选择相机如何跟随飞行中的模型。自由模式可手动操作相机。
          </p>

          <div class="button-row">
            <el-button size="small" :type="cameraMode === 'free' ? 'primary' : ''" :disabled="!hasAnimation"
              @click="setCameraMode('free')">
              🆓 自由
            </el-button>
            <el-button size="small" :type="cameraMode === 'follow' ? 'primary' : ''" :disabled="!hasAnimation"
              @click="setCameraMode('follow')">
              👀 跟随
            </el-button>
            <el-button size="small" :type="cameraMode === 'overlook' ? 'primary' : ''" :disabled="!hasAnimation"
              @click="setCameraMode('overlook')">
              🛰️ 俯瞰
            </el-button>
          </div>

          <div v-if="hasAnimation" class="info-box">
            {{ cameraMode === 'free' ? '自由视角 — 可手动操作相机' :
              cameraMode === 'follow' ? '跟随视角 — 相机跟随模型侧后方' :
                '俯瞰视角 — 相机从正上方跟踪模型' }}
          </div>
        </el-card>

      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartesian3,
  Color,
  JulianDate,
  SampledPositionProperty,
  VelocityOrientationProperty,
  PathGraphics,
  PolylineGlowMaterialProperty,
  Entity,
  ConstantProperty,
  ClockRange,
  Math as CesiumMath,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { publicUrl } from "@/utils/public-url"

// ── 路径预设 ──

interface PathPoint { t: number; lon: number; lat: number; alt: number }

const PATH_PRESETS: Record<string, { name: string; points: PathPoint[] }> = {
  beijing: {
    name: "北京环飞",
    points: [
      { t: 0, lon: 115.5, lat: 39.5, alt: 1500 },
      { t: 10, lon: 115.8, lat: 39.7, alt: 2000 },
      { t: 20, lon: 116.2, lat: 39.9, alt: 2500 },
      { t: 30, lon: 116.6, lat: 40.0, alt: 3000 },
      { t: 40, lon: 117.0, lat: 39.8, alt: 2500 },
      { t: 50, lon: 117.3, lat: 39.5, alt: 2000 },
      { t: 60, lon: 117.0, lat: 39.2, alt: 1500 },
      { t: 70, lon: 116.5, lat: 39.0, alt: 1000 },
      { t: 80, lon: 116.0, lat: 39.0, alt: 800 },
      { t: 90, lon: 115.5, lat: 39.5, alt: 1500 },
    ],
  },
  straight: {
    name: "直线往返",
    points: [
      { t: 0, lon: 115.0, lat: 40.0, alt: 3000 },
      { t: 20, lon: 117.0, lat: 40.0, alt: 3000 },
      { t: 40, lon: 115.0, lat: 40.0, alt: 3000 },
      { t: 60, lon: 117.0, lat: 40.0, alt: 3000 },
    ],
  },
}

const MODEL_CONFIGS: Record<string, { path: string; scale: number; label: string }> = {
  feiji: { path: publicUrl("cesium-data/models/feiji.glb"), scale: 3, label: "客机" },
  missile: { path: publicUrl("cesium-data/models/missile/scene.gltf"), scale: 100, label: "导弹" },
  dji: { path: publicUrl("cesium-data/models/dji_tello/scene.gltf"), scale: 100, label: "无人机" },
}

// ── UI 状态 ──
const panelOpen = ref(false) // 底图面板展开/收起
const currentId = ref("") // 当前底图 ID
const currentLabel = ref("") // 当前底图中文名

const selectedModel = ref("feiji") // 选中模型 feiji/missile/dji
const selectedPath = ref("beijing") // 选中路径 beijing/straight
const isPlaying = ref(false) // 是否正在播放
const speed = ref(5) // 播放倍速
const speedOptions = [1, 2, 5, 10, 50] // 可选倍速列表
const progress = ref(0) // 进度条百分比 0-100
const cameraMode = ref<"free" | "follow" | "overlook">("free") // 相机模式
const hasAnimation = ref(false) // 是否有活跃的飞行动画
const animInfo = ref("") // 动画摘要文字，如：客机 · 北京环飞 · 90s

// 已过时间（MM:SS），tick 中随 clock.currentTime 更新
const elapsedStr = ref("00:00")
// 总时长（MM:SS），创建动画时由 pathCfg 总秒数决定
const totalStr = ref("00:00")
// 仿真时钟当前时刻（yyyy-MM-dd HH:mm:ss），tick 中每帧刷新
const simTimeStr = ref("")

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let flightEntity: Entity | null = null
let clockRemoveTick: (() => void) | null = null

// 路径采样时间基准
let animStart: JulianDate | null = null
let animStop: JulianDate | null = null

// ── 工具 ──

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  // 将分钟数 m 和秒数 s 转换成字符串，并在左侧用 "0" 补齐，确保总长度至少为 2 位。
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function formatProgress(val: number): string {
  return `${val}%`
}

// ══════════════════════════════════════════
// 卡片一：飞行路径
// ══════════════════════════════════════════

// typeof PATH_PRESETS["beijing"] 就是 { name: string; points: PathPoint[] }，
// 也就是 Record 的 value 类型。正规写法应该是另设一个interface，这里算是偷懒了。
function buildPathPosition(preset: typeof PATH_PRESETS["beijing"], start: JulianDate): SampledPositionProperty {
  // SampledPositionProperty 是 Cesium Entity 系统里用于描述随时间变化的位置的属性。
  // 他是“一串带时间的位置采样点”，Cesium 根据时间自动计算对象在哪里。
  // 断掉的部分会自动插值。
  const prop = new SampledPositionProperty()
  preset.points.forEach(p => {
    const time = JulianDate.addSeconds(start, p.t, new JulianDate())
    const pos = Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
    prop.addSample(time, pos)
  })
  return prop
}

function startAnimation() {
  if (!viewer) return

  // 清除已有动画
  if (hasAnimation.value) clearAnimation()

  const modelCfg = MODEL_CONFIGS[selectedModel.value]
  const pathCfg = PATH_PRESETS[selectedPath.value]
  if (!modelCfg || !pathCfg) return

  // 时间范围
  const base = JulianDate.fromIso8601("2026-07-22T00:00:00Z")
  // t是路径点的时间偏移量，单位是秒。取最后一个点的 t 作为总时长。
  const totalSec = pathCfg.points[pathCfg.points.length - 1].t
  animStart = base
  animStop = JulianDate.addSeconds(base, totalSec, new JulianDate())

  // 构造位置采样
  const position = buildPathPosition(pathCfg, base)

  // 创建飞行 entity
  // entity与cesium时钟系统绑定并不明显：flightEntity 不需要手动绑定时钟——Cesium 的 
  // time-dynamic property 系统会自动读取 viewer.clock.currentTime 来插值计算位置。
  // SampledPositionProperty 采样点有时间戳，Cesium 会根据当前时刻自动计算出模型位置。
  // 这也是为什么改了 clock.currentTime（比如拖进度条）模型位置立刻跳变。
  flightEntity = viewer.entities.add({
    position,
    // VelocityOrientationProperty 会根据位置采样自动计算姿态（航向、俯仰、滚转），无需手动设置。
    orientation: new VelocityOrientationProperty(position),
    model: {
      uri: modelCfg.path,
      scale: modelCfg.scale,
      minimumPixelSize: 64, // 模型在屏幕上最小显示多少像素。
    },
    // PathGraphics 用于在模型后面绘制路径轨迹。
    path: new PathGraphics({
      // 轨迹采样间隔。1就是每秒采样一次，0.1就是每0.1秒采样一次。
      // 采样越密，轨迹越平滑，但性能开销也越大。
      resolution: 0.1,
      // material 是轨迹材质，这里使用发光材质，glowPower 控制发光强度，color 控制颜色。
      material: new PolylineGlowMaterialProperty({ glowPower: 0.1, color: Color.CYAN }),
      width: 3,
      leadTime: 0, // 显示未来轨迹多久。
      trailTime: Math.min(totalSec, 60),
    }),
  })

  // 配置时钟
  viewer.clock.startTime = animStart
  viewer.clock.stopTime = animStop
  viewer.clock.currentTime = animStart // ← 时钟从 base 开始，绝对仿真时刻。
  viewer.clock.multiplier = speed.value // 默认是5
  viewer.clock.shouldAnimate = false // 控制动画播放，默认不自动播放，点击「播放」后才开始
  // 设置了 ClockRange.LOOPED 后，当仿真时间到达终点时，Cesium 会自动将时钟时间重置回起点，
  // 模型会瞬间回到路径起始位置并继续飞行，从而实现无限循环飞行的效果。
  viewer.clock.clockRange = ClockRange.LOOP_STOP

  isPlaying.value = false
  hasAnimation.value = true
  progress.value = 0

  totalStr.value = formatSeconds(totalSec)
  elapsedStr.value = "00:00"

  animInfo.value = `${modelCfg.label} · ${pathCfg.name} · ${totalSec}s` // 如：客机 · 北京环飞 · 90s

  // 飞入初始视角
  const first = pathCfg.points[0]
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(first.lon-0.02, first.lat-0.03, first.alt + 5000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-60), roll: 0 },
    duration: 1.0,
  })

  // 注册时钟 tick
  // onTick 会在每一帧渲染时被调用，更新 elapsedStr、simTimeStr、progress 等 UI 状态。
  // clock.onTick.addEventListener() 返回的是一个移除函数，调用它可以取消注册。
  clockRemoveTick = viewer.clock.onTick.addEventListener(onTick)
}

/**
| 方法                                    | 返回清除函数？ | 删除方式            |
| ------------------------------------- | ------- | ---------------------------|
| `Event.addEventListener()`            | ✅       | 调用返回函数              |
| `clock.onTick.addEventListener()`     | ✅       | `remove()`               |
| `camera.changed.addEventListener()`   | ✅       | `remove()`               |
| `scene.postRender.addEventListener()` | ✅       | `remove()`               |
| `setInputAction()`                    | ❌       | `removeInputAction()`    |
| `entities.add()`                      | ❌       | `entities.remove()`      |
| `primitives.add()`                    | ❌       | `primitives.remove()`    |
| `imageryLayers.add()`                 | ❌       | `imageryLayers.remove()` |
| `readyPromise.then()`                 | ❌       | Promise无法取消（通常）    |
 */

function clearAnimation() {
  if (!viewer) return

  // 清除时钟 tick。Cesium 的 Event.addEventListener() 返回的是移除函数。
  // 调用 clockRemoveTick() → 通知 Cesium：移除这个监听器
  // clockRemoveTick = null → 清 JS 变量引用
  if (clockRemoveTick) { clockRemoveTick(); clockRemoveTick = null }

  if (flightEntity) {
    viewer.entities.remove(flightEntity)
    flightEntity = null
  }

  // 设置查看器的时钟动画状态为停止
  // shouldAnimate属性用于控制查看器是否自动播放动画
  viewer.clock.shouldAnimate = false

  isPlaying.value = false
  hasAnimation.value = false
  progress.value = 0
  animInfo.value = ""
  elapsedStr.value = "00:00"
  totalStr.value = "00:00"
  simTimeStr.value = ""
  cameraMode.value = "free"
}

// ══════════════════════════════════════════
// 卡片二：时间控制
// ══════════════════════════════════════════

function togglePlay() {
  if (!viewer || !hasAnimation.value) return
  viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate
  isPlaying.value = viewer.clock.shouldAnimate
}

function setSpeed(val: number) {
  speed.value = val
  if (viewer) viewer.clock.multiplier = val
}

function onSeek(val: number) {
  if (!viewer || !animStart || !animStop) return
  const total = JulianDate.secondsDifference(animStop, animStart)
  const offset = total * (val / 100)
  viewer.clock.currentTime = JulianDate.addSeconds(animStart, offset, new JulianDate())
  // 让 tick 处理程序更新显示
}

function resetAnimation() {
  if (!viewer || !animStart) return
  viewer.clock.currentTime = JulianDate.clone(animStart)
  viewer.clock.shouldAnimate = false
  isPlaying.value = false
  progress.value = 0
}

// ══════════════════════════════════════════
// 时钟 tick
// ══════════════════════════════════════════

function onTick(clock: any) {
  if (!animStart || !animStop) return

  // 总时间
  const total = JulianDate.secondsDifference(animStop, animStart)
  // 已过时间 = 当前时刻 - 起始时刻，单位：秒
  const elapsed = JulianDate.secondsDifference(clock.currentTime, animStart)

  // 进度
  progress.value = total > 0 ? Math.round((elapsed / total) * 100) : 0

  // 时间显示
  elapsedStr.value = formatSeconds(Math.max(0, elapsed))
  // viewer.clock.currentTime = animStart = base，此处currentTime绑定了base时间。
  simTimeStr.value = JulianDate.toDate(clock.currentTime).toISOString().replace("T", " ").slice(0, 19)
}

// ══════════════════════════════════════════
// 卡片三：相机模式
// 使用 viewer.trackedEntity 绑定相机跟随的 entity。
// ══════════════════════════════════════════

function setCameraMode(mode: "free" | "follow" | "overlook") {
  cameraMode.value = mode
  if (!viewer || !flightEntity) return

  if (mode === "free") {
    viewer.trackedEntity = undefined as any
    // 清除 entity 上之前设置的 viewFrom
    flightEntity.viewFrom = undefined as any
    return
  }

  // 重新绑定 trackedEntity，使新的 viewFrom 生效
  viewer.trackedEntity = undefined as any

  // viewFrom 偏移量（单位：米，entity 局部坐标系：x=右, y=前, z=上）
  if (mode === "overlook") {
    flightEntity.viewFrom = new ConstantProperty(new Cartesian3(0, 0, 10000))       // 正上方 8km
  } else {
    flightEntity.viewFrom = new ConstantProperty(new Cartesian3(-600, -300, 10000))  // 后上方 3km + 上 10km
  }

  viewer.trackedEntity = flightEntity
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

  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "mars3d")!
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 15000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })
})

onUnmounted(() => {
  if (clockRemoveTick) { clockRemoveTick(); clockRemoveTick = null }
  if (viewer) {
    if (flightEntity) viewer.entities.remove(flightEntity)
    viewer.destroy()
    viewer = null
  }
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

.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 370px;
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
  padding: 12px;
}

.card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 10px;
}

.card-hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  margin: 4px 0;
}

.button-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.button-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 8px 4px;
  min-width: 0;
}

/* ── 选择行 ── */
.select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.select-row .sel-label {
  min-width: 40px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.select-row .el-radio-group {
  display: flex;
  gap: 2px;
}

.select-row .el-radio-button__inner {
  font-size: 11px;
  padding: 6px 10px;
}

/* ── 播放行 ── */
.play-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.play-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 8px 4px;
}

/* ── 速度行 ── */
.speed-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.speed-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 40px;
  flex-shrink: 0;
}

.speed-btns {
  display: flex;
  gap: 4px;
  flex: 1;
}

.speed-btns .el-button {
  flex: 1;
  font-size: 11px;
  padding: 6px 2px;
}

/* ── 进度行 ── */
.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.progress-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  min-width: 40px;
  flex-shrink: 0;
}

.progress-row .el-slider {
  flex: 1;
}

/* ── 时间显示 ── */
.time-display {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 6px 8px;
  background: var(--el-color-info-light-9);
  border-radius: 4px;
  font-size: 11px;
  font-family: monospace;
}

.time-elapsed {
  color: var(--el-color-primary);
  font-weight: 600;
}

.time-sep {
  color: var(--el-text-color-placeholder);
}

.time-total {
  color: var(--el-text-color-secondary);
}

.time-clock {
  margin-left: auto;
  color: var(--el-text-color-secondary);
}

/* ── 信息框 ── */
.info-box {
  margin-top: 6px;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
  line-height: 1.5;
}
</style>
