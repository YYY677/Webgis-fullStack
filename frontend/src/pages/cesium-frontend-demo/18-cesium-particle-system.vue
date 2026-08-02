<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher
        :activate="switchBasemap"
        :initial="currentId"
        @toggle="(v: boolean) => panelOpen = v"
      />
    </div>

    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">

        <!-- ════════════ 卡片一：效果选择 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎆 粒子效果 — ParticleSystem</template>

          <p class="card-desc">
            粒子系统是 GPU 端渲染的轻量 Sprite 集合。每种效果由
            <code>ParticleEmitter</code> 控制发射形状与方向。
          </p>

          <div class="button-grid">
            <el-button :type="activeEffect === 'fire' ? 'primary' : 'default'"
              @click="applyEffect('fire')">🔥 火焰</el-button>
            <el-button :type="activeEffect === 'smoke' ? 'primary' : 'default'"
              @click="applyEffect('smoke')">💨 烟雾</el-button>
            <el-button :type="activeEffect === 'explosion' ? 'primary' : 'default'"
              @click="applyEffect('explosion')">💥 爆炸</el-button>
          </div>

          <div v-if="activeEffect" class="status-box">
            当前：{{ activeEffect === 'fire' ? 'CircleEmitter 地面火焰' : activeEffect === 'smoke' ? 'ConeEmitter 上升烟雾' : 'SphereEmitter 短时爆炸' }}
          </div>

          <div class="toolbar-row">
            <el-button size="small" type="danger" plain :disabled="!activeEffect"
              @click="clearEffect">清除粒子</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片二：运行时参数调整 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎛️ 粒子参数（实时生效）</template>

          <p class="card-desc">
            ParticleSystem 的属性是公开 getter/setter，拖动滑块直接写入
            运行中的粒子系统，无需重新创建。
          </p>

          <div class="slider-row">
            <label>发射速率</label>
            <el-slider v-model="params.emissionRate" :min="5" :max="300" :step="5"
              @update:modelValue="updateParams" />
            <span class="slider-val">{{ params.emissionRate }}/s</span>
          </div>

          <div class="slider-row">
            <label>粒子寿命</label>
            <el-slider v-model="params.particleLife" :min="0.5" :max="5" :step="0.1"
              @update:modelValue="updateParams" />
            <span class="slider-val">{{ params.particleLife }}s</span>
          </div>

          <div class="slider-row">
            <label>发射速度</label>
            <el-slider v-model="params.speed" :min="2" :max="50" :step="1"
              @update:modelValue="updateParams" />
            <span class="slider-val">{{ params.speed }} m/s</span>
          </div>

          <div class="slider-row">
            <label>粒子尺寸</label>
            <el-slider v-model="params.imageSize" :min="5" :max="40" :step="1"
              @update:modelValue="updateParams" />
            <span class="slider-val">{{ params.imageSize }}m</span>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：API 说明 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>📖 关键 API</template>

          <p class="card-desc">
            粒子系统通过 <code>viewer.scene.primitives.add()</code> 接入渲染管线，
            由 Cesium 时钟驱动更新。每个系统用 <code>modelMatrix</code> 定位世界坐标，
            <code>ParticleEmitter</code> 决定粒子"从哪里发、往哪飞"。
          </p>

          <p class="card-desc" style="margin-bottom: 4px;">
            四种发射器的区别：
          </p>
          <pre class="code-note">CircleEmitter(半径)   平面圆发射，方向随机   → 火焰、喷泉
ConeEmitter(半锥角)  锥形发射，集中向上扩散 → 烟雾、火花
SphereEmitter(半径)  球面发射，全向爆开     → 爆炸
BoxEmitter(尺寸)     立方体体积内随机       → 碎片、粉尘</pre>

          <p class="card-desc" style="margin-bottom: 4px;">
            关键参数速查：
          </p>
          <pre class="code-note">emissionRate         每秒发射数（持续发射）
bursts               指定时刻一次性爆发（爆炸）
lifetime             系统发射总时长（秒）
particleLife         单个粒子存活时长（min~max）
speed                粒子初速度（min~max，m/s）
imageSize            粒子尺寸；sizeInMeters: true 时单位为米
startColor/endColor  出生→死亡的颜色渐变
startScale/endScale  出生→死亡的尺寸倍数
updateCallback       每粒子每帧自定义更新（重力/风力写在这里）</pre>

          <p class="card-desc" style="margin-bottom: 0;">
            ⚠️ Cesium 粒子<strong>没有内置重力</strong>，粒子沿初速度匀速直线飞行；
            需要重力或风力时在 <code>updateCallback</code> 中修改
            <code>particle.velocity</code>。<code>mass</code> 也只在该回调中有意义。
          </p>
        </el-card>

      </el-scrollbar>
    </div>
  </div>
</template>

<script lang="ts">
import { Color } from "cesium"

/** 创建径向渐变圆形粒子纹理（白色中心 → 透明边缘） */
export function createCircularParticleImage(): string {
  const size = 32
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  )
  gradient.addColorStop(0, "rgba(255, 255, 255, 1)")
  gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.9)")
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)")
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  return canvas.toDataURL()
}

/**
 * 不同效果的预设参数（依赖 3 种内置发射器）。
 *
 * - emitter:    发射器类型。circle=平面圆（地面喷发）、cone=锥形（向上扩散）、sphere=球面（全向爆炸）
 * - position:   粒子系统所在的经纬度与高度（米），生成 modelMatrix 定位
 * - speed:      粒子的最大速度（m/s），实际速度在 30%~100% 之间随机，让粒子有快慢差异
 * - startScale: 粒子出生时的尺寸倍数（实际尺寸 = imageSize × scale）
 * - endScale:   粒子死亡时的尺寸倍数 —— 0.5→10 倍 = 从小火苗膨胀成大火焰
 * - startColor: 粒子出生时的颜色
 * - endColor:   粒子死亡时的颜色 —— 中间渐变，endColor 的 alpha 通常为 0（淡出）
 */
export const PARTICLE_PRESETS: Record<
  string,
  {
    emitter: "circle" | "cone" | "sphere"
    position: [number, number, number]
    speed: number
    startScale: number
    endScale: number
    startColor: Color
    endColor: Color
  }
> = {
  // 火焰：CircleEmitter 地面喷发，橙 → 红淡出，从小火苗膨胀成大火焰
  fire: {
    emitter: "circle",
    position: [116.39, 39.91, 50],
    speed: 6,
    startScale: 0.5,
    endScale: 10.0,
    startColor: Color.ORANGE.withAlpha(0.9),
    endColor: Color.RED.withAlpha(0.0),
  },
  // 烟雾：ConeEmitter 锥形向上扩散，灰 → 白渐隐
  smoke: {
    emitter: "cone",
    position: [116.39, 39.91, 80],
    speed: 4,
    startScale: 2.0,
    endScale: 8.0,
    startColor: Color.GRAY.withAlpha(0.7),
    endColor: Color.WHITE.withAlpha(0.0),
  },
  // 爆炸：SphereEmitter 全向爆开，用 burst 一次性爆发，速度最快、膨胀最猛
  explosion: {
    emitter: "sphere",
    position: [116.39, 39.91, 200],
    speed: 30,
    startScale: 0.5,
    endScale: 15.0,
    startColor: Color.ORANGE.withAlpha(0.9),
    endColor: Color.RED.withAlpha(0.0),
  },
}
</script>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartesian3,
  Cartesian2,
  Math as CesiumMath,
  ParticleSystem,
  ParticleBurst,
  CircleEmitter,
  ConeEmitter,
  SphereEmitter,
  Transforms,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
const activeEffect = ref<"fire" | "smoke" | "explosion" | null>(null)

// 粒子可调参数（实时修改后需重新应用效果才能生效）
const params = reactive({
  emissionRate: 80,
  particleLife: 1.5,
  speed: 6,
  imageSize: 25,
})

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let currentSystem: ParticleSystem | null = null

// ══════════════════════════════════════════
// 粒子效果
// ══════════════════════════════════════════

function applyEffect(name: "fire" | "smoke" | "explosion") {
  if (!viewer) return
  // 先清理旧系统
  clearEffect()

  // 粒子系统由 Cesium 时钟驱动，必须开启动画；否则系统不更新，看不到效果
  viewer.clock.shouldAnimate = true
  // 关闭地形深度测试，避免粒子被地形表面深度剔除
  viewer.scene.globe.depthTestAgainstTerrain = false

  const preset = PARTICLE_PRESETS[name]
  // 每种效果有默认速度（火焰慢、爆炸快），点击时同步到滑块初值，用户可再微调
  params.speed = preset.speed
  const image = createCircularParticleImage()
  const position = Cartesian3.fromDegrees(...preset.position)
  // modelMatrix：把粒子系统定位到世界坐标（ENU = 在 position 处建立东-北-上局部坐标系）
  const modelMatrix = Transforms.eastNorthUpToFixedFrame(position)

  let emitter: CircleEmitter | ConeEmitter | SphereEmitter
  if (preset.emitter === "circle") {
    emitter = new CircleEmitter(3.0) // 3m 半径的平面圆发射面
  } else if (preset.emitter === "cone") {
    // ConeEmitter 第一个参数是锥角（弧度），默认向上发射
    emitter = new ConeEmitter(CesiumMath.toRadians(15))
  } else {
    emitter = new SphereEmitter(5.0) // 5m 半径球面，全向发射
  }

  const isExplosion = name === "explosion"
  // 粒子寿命与速度使用范围值，让粒子大小、飞行距离有自然差异
  const maxLife = params.particleLife
  const minLife = Math.max(0.3, maxLife * 0.4)
  const maxSpeed = params.speed
  const minSpeed = Math.max(0.5, maxSpeed * 0.3)

  const system = new ParticleSystem({
    modelMatrix,
    emitter,
    // 爆炸关闭持续发射（emissionRate=0）、改用 burst 一次性爆发
    emissionRate: isExplosion ? 0 : params.emissionRate,
    // lifetime：系统持续发射的总时长（秒），到点停止；爆炸 1 秒内爆完
    lifetime: isExplosion ? 1.0 : 30.0,
    // loop：lifetime 结束后是否循环（配合 bursts 才有意义）
    loop: true,
    // particleLife（min~max）：单个粒子出生到死亡的存活时长（秒）
    minimumParticleLife: minLife,
    maximumParticleLife: maxLife,
    // speed（min~max）：粒子初速度范围（m/s），决定喷发高度/距离
    minimumSpeed: minSpeed,
    maximumSpeed: maxSpeed,
    // startColor/endColor：粒子出生→死亡的颜色渐变（含 alpha 淡出）
    startColor: preset.startColor,
    endColor: preset.endColor,
    // startScale/endScale：出生→死亡的尺寸倍数（实际尺寸 = imageSize × scale）
    startScale: preset.startScale,
    endScale: preset.endScale,
    // imageSize + sizeInMeters：粒子尺寸；true 时单位为米（远处可见），false 为像素
    imageSize: new Cartesian2(params.imageSize, params.imageSize),
    sizeInMeters: true,
    // image：粒子贴图。粒子 = 带贴图的 billboard，颜色由 start/endColor 染，形状由贴图 alpha 定。
    // 白色径向渐变圆是通用粒子贴图（中心实、边缘透明），Canvas 生成避免外部图片依赖
    image,
    // bursts：指定时刻一次性爆发 min~max 个粒子（爆炸冲击波）；持续发射用 emissionRate
    bursts: isExplosion
      ? [new ParticleBurst({ time: 0, minimum: 200, maximum: 300 })]
      : undefined,
  })

  // 粒子系统是 Primitive 的子类，添加到场景后由 Cesium 时钟驱动更新
  viewer.scene.primitives.add(system)
  currentSystem = system
  activeEffect.value = name

  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(preset.position[0], preset.position[1], 2500),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function clearEffect() {
  if (!viewer || !currentSystem) return
  viewer.scene.primitives.remove(currentSystem)
  currentSystem = null
  activeEffect.value = null
  // 恢复地形深度测试
  viewer.scene.globe.depthTestAgainstTerrain = true
}

/** 滑块实时更新：直接写入运行中的粒子系统属性 */
function updateParams() {
  if (!viewer || !currentSystem) return
  const isExplosion = activeEffect.value === "explosion"
  currentSystem.emissionRate = isExplosion ? 0 : params.emissionRate
  // 寿命与速度始终以范围值写入，保留粒子差异
  const maxLife = params.particleLife
  currentSystem.minimumParticleLife = Math.max(0.3, maxLife * 0.4)
  currentSystem.maximumParticleLife = maxLife
  const maxSpeed = params.speed
  currentSystem.minimumSpeed = Math.max(0.5, maxSpeed * 0.3)
  currentSystem.maximumSpeed = maxSpeed
  // 构造时 imageSize 只是快捷选项，类上公开属性是 min/max 两个
  const size = new Cartesian2(params.imageSize, params.imageSize)
  currentSystem.minimumImageSize = size
  currentSystem.maximumImageSize = size
}

// ── 底图切换 ──

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

// ── 生命周期 ──

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
    destination: Cartesian3.fromDegrees(116.39, 39.91, 8000),
  })
})

onUnmounted(() => {
  if (viewer) {
    if (currentSystem) {
      viewer.scene.primitives.remove(currentSystem)
    }
    viewer.destroy()
    viewer = null
  }
  currentSystem = null
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

:deep(.cesium-viewer-bottom) { display: none !important; }
:deep(.cesium-viewer-toolbar) { display: none !important; }

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
  background: rgba(0, 0, 0, 0.55);
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
  width: 340px;
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

/* ── 卡片描述 ── */
.card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 10px;
}

/* ── 按钮 ── */
.button-grid {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.button-grid .el-button {
  flex: 1;
  font-size: 12px;
  padding: 8px 4px;
  min-width: 0;
}

.toolbar-row {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.toolbar-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 6px 4px;
}

.status-box {
  font-size: 12px;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  padding: 6px 10px;
  border-radius: 4px;
}

/* ── 滑块 ── */
.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.slider-row label {
  min-width: 70px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

.slider-row .slider-val {
  min-width: 48px;
  text-align: right;
  font-size: 12px;
  font-family: monospace;
  color: var(--el-color-primary);
}

.slider-row .el-slider {
  flex: 1;
}

/* ── 代码块 ── */
.code-note {
  margin: 0 0 10px;
  padding: 10px;
  background: var(--el-fill-color);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
