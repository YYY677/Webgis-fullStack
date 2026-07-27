<template>
  <div id="cesiumContainer" class="map-container">
    <!-- 遮罩层：面板打开时覆盖地图，点击关闭面板 -->
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />

    <!-- 右上角底图切换 -->
    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher
        :activate="switchBasemap"
        :initial="currentId"
        @toggle="(v: boolean) => panelOpen = v"
      />
    </div>

    <!-- 左侧控制面板 -->
    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">
        <!-- ──────────── 面板 1：相机姿态控制 ──────────── -->
        <el-card shadow="never" class="panel-card">
          <template #header><span>🎥 相机姿态控制</span></template>

          <div class="slider-row">
            <label>Heading</label>
            <el-slider v-model="heading" :min="0" :max="360" :step="0.1"
              @update:modelValue="applyCameraOrientation" />
            <span class="slider-val">{{ heading.toFixed(1) }}°</span>
          </div>

          <div class="slider-row">
            <label>Pitch</label>
            <el-slider v-model="pitch" :min="-87" :max="87" :step="0.1"
              @update:modelValue="applyCameraOrientation" />
            <span class="slider-val">{{ pitch.toFixed(1) }}°</span>
          </div>

          <div class="slider-row">
            <label>Roll</label>
            <el-slider v-model="roll" :min="-180" :max="180" :step="0.1"
              @update:modelValue="applyCameraOrientation" />
            <span class="slider-val">{{ roll.toFixed(1) }}°</span>
          </div>

          <div class="button-row">
            <el-button size="small" @click="resetView">重置</el-button>
          </div>
        </el-card>

        <!-- ──────────── 面板 2：相机坐标 ──────────── -->
        <el-card shadow="never" class="panel-card">
          <template #header><span>📍 相机坐标</span></template>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="经度（度）">{{ lon.toFixed(6) }}°</el-descriptions-item>
            <el-descriptions-item label="纬度（度）">{{ lat.toFixed(6) }}°</el-descriptions-item>
            <el-descriptions-item label="高度（m）">{{ height.toFixed(2) }}</el-descriptions-item>
            <el-descriptions-item label="Heading">{{ heading.toFixed(1) }}°</el-descriptions-item>
            <el-descriptions-item label="Pitch">{{ pitch.toFixed(1) }}°</el-descriptions-item>
            <el-descriptions-item label="Roll">{{ roll.toFixed(1) }}°</el-descriptions-item>
            <el-descriptions-item label="Cartesian3"><code>{{ cartesianStr }}</code></el-descriptions-item>
            <el-descriptions-item label="Cartographic (rad)"><code>{{ cartographicStr }}</code></el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- ──────────── 面板 3：鼠标拾取坐标 ──────────── -->
        <el-card shadow="never" class="panel-card">
          <template #header><span>🖱️ 鼠标拾取坐标</span></template>

          <p v-if="!clickInfo" class="click-hint">点击地图任意位置查看坐标</p>

          <el-descriptions v-else :column="1" border size="small">
            <el-descriptions-item label="屏幕坐标（像素）">
              ({{ clickInfo.screenX }}, {{ clickInfo.screenY }})
            </el-descriptions-item>
            <el-descriptions-item label="椭球交点 (Cartesian3)">
              <code>{{ clickInfo.ellipsoidCartesian }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="椭球交点 (经纬度)">
              {{ clickInfo.ellipsoidDeg }}
            </el-descriptions-item>
            <el-descriptions-item label="场景位置 (Cartesian3)">
              <code>{{ clickInfo.sceneCartesian }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="场景位置 (经纬度)">
              {{ clickInfo.sceneDeg }}
            </el-descriptions-item>
            <el-descriptions-item label="地表位置 (Cartesian3)">
              <code>{{ clickInfo.globeCartesian }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="地表位置 (经纬度)">
              {{ clickInfo.globeDeg }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue"
import { ElMessage } from "element-plus"
import {
  Viewer,
  Ion,
  Cartesian3,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartographic,
} from "cesium"
// 加载 Cesium 默认 UI 控件的样式，Cesium Viewer 容器本身依赖这些 CSS 来正确定位布局
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")

// ── 相机姿态（绑定滑块） ──
const heading = ref(0)
// Cesium 在接近 ±90° 时将 Heading 与 Roll 视为不可唯一表示，限制到 ±87°。
const pitch = ref(-87)
// UI 用有符号 Roll 表示左/右滚转；Cesium 回读时再从 [0°, 360°] 转换回来。
const roll = ref(0)

// ── 相机坐标显示 ──
const lon = ref(0)
const lat = ref(0)
const height = ref(0)
const cartesianStr = ref("")
const cartographicStr = ref("")

// ── 鼠标拾取结果 ──
interface ClickPickInfo {
  screenX: number
  screenY: number
  ellipsoidCartesian: string
  ellipsoidDeg: string
  sceneCartesian: string
  sceneDeg: string
  globeCartesian: string
  globeDeg: string
}
const clickInfo = ref<ClickPickInfo | null>(null)

// ── Cesium 非响应式引用 ──
let viewer: Viewer | null = null
let clickHandler: ScreenSpaceEventHandler | null = null

// ── 辅助：Cartesian3 → 可读字符串 ──
function formatCart(c: any): string {
  if (!c) return "无数据"
  return `(${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)})`
}

function formatDeg(c: any): string {
  if (!c) return "无数据"
  try {
    const carto = Cartographic.fromCartesian(c)
    const lng = CesiumMath.toDegrees(carto.longitude).toFixed(6)
    const lat = CesiumMath.toDegrees(carto.latitude).toFixed(6)
    return `${lng}°, ${lat}°, ${carto.height.toFixed(2)}m`
  } catch {
    return "无法转换"
  }
}

// Cesium API 用 [0°, 360°] 表示 Roll；UI 保持 [-180°, 180°]，让负值直观表示左滚转。
function toSignedRollDegrees(rollRadians: number): number {
  const degrees = CesiumMath.toDegrees(rollRadians)
  const signedDegrees = degrees > 180 ? degrees - 360 : degrees
  return Math.abs(signedDegrees) < 0.05 ? 0 : +signedDegrees.toFixed(1)
}

// ── 每帧同步：相机状态 → UI refs（用于坐标和滑块回显） ──
function syncCameraToUI() {
  if (!viewer) return

  const camera = viewer.camera

  // ── 三个姿态角 ──
  // Heading（偏航角/方位角）：绕向上轴（Z）旋转，0=正北，90=正东，顺时针递增，范围 [0, 360)
  //   飞机比喻：机头左右摆动，即"航向"
  // Pitch（俯仰角）：绕横向轴（X）旋转，0=水平，负值向下俯视，范围 [-87, 87]
  //   飞机比喻：机头上下摆动，即"俯仰"
  // Roll（滚转角）：绕纵向轴（Y）旋转，0=水平，正=向右倾斜，范围 [-180, 180]
  //   飞机比喻：机身绕中轴线旋转，即"横滚"
  heading.value = +CesiumMath.toDegrees(camera.heading).toFixed(1)
  pitch.value = +CesiumMath.toDegrees(camera.pitch).toFixed(1)
  roll.value = toSignedRollDegrees(camera.roll)

  // ── 三种坐标系（同一空间点的三种数学表达） ──
  const carto = camera.positionCartographic // 拿到的是 Cartographic 弧度坐标系

  // 【坐标系 1】经纬度（度）— 人类最直观的表达
  //   日常说的"东经116°，北纬40°"。lon ∈ [-180, 180]，lat ∈ [-90, 90]
  //   Cesium 用 Cartesian3.fromDegrees(lon, lat, height) 创建位置
  lon.value = +CesiumMath.toDegrees(carto.longitude).toFixed(6)
  lat.value = +CesiumMath.toDegrees(carto.latitude).toFixed(6)
  height.value = +carto.height.toFixed(2)

  // 【坐标系 2】Cartographic（弧度）— 经纬度的弧度版，数学计算用
  //   弧度 = 度 × π / 180。lon ∈ [-π, π]，lat ∈ [-π/2, π/2]
  //   Cesium 内部用弧度算角度，Cartographic 类型存储的就是弧度值
  //   Cartographic 负责地理空间计算。计算机数学库基本都使用弧度
  //   Cartographic存在的意义不是“替代经纬度”，而是把地理位置转换成 Cesium 内部统一的数学表示
  // （弧度+米），方便地理算法；Cartesian3则把这个地理位置转换成地心三维空间坐标，方便三维渲染。
  //  在经纬度到Cartesian3的数学转换过程中，必须经过弧度，因为椭球公式需要三角函数计算。
  cartographicStr.value =
    `(${carto.longitude.toFixed(8)}, ${carto.latitude.toFixed(8)}, ${carto.height.toFixed(2)})`

  // 【坐标系 3】Cartesian3（笛卡尔三维坐标）— Cesium 底层计算核心
  //   以地球中心为原点的三维直角坐标系，单位：米
  //   Cesium 所有空间运算（距离 / 碰撞 / 插值）都在此坐标系中完成
  //   Cartesian3 负责三维空间计算
  //     模型顶点移动；矩阵变换；相机位置；光照；GPU渲染
  const wc = camera.positionWC
  cartesianStr.value = `(${wc.x.toFixed(2)}, ${wc.y.toFixed(2)}, ${wc.z.toFixed(2)})`

}

// ── 应用滑块值到相机 ──
function applyCameraOrientation() {
  if (!viewer) return
  viewer.camera.setView({
    orientation: {
      heading: CesiumMath.toRadians(heading.value),
      pitch: CesiumMath.toRadians(pitch.value),
      roll: CesiumMath.toRadians(roll.value),
    },
  })
}

// ── 预设视角 ──
function resetView() {
  heading.value = 0
  pitch.value = -87
  roll.value = 0
  applyCameraOrientation()
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

// ── 鼠标点击拾取 ──
function setupClickHandler() {
  if (!viewer) return null
  // ScreenSpaceEventHandler 是 Cesium 提供的鼠标事件处理器，
  // 允许我们监听鼠标点击、移动等事件。
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas)

  // setInputAction(fn, LEFT_CLICK) = "当左键点击时执行 fn"，
  // LEFT_CLICK 那个枚举值就是事件名。
  handler.setInputAction((click: any) => {
    if (!viewer) return
    const { x, y } = click.position

    // 椭球交点（无地形/模型），假设地球是一个完美椭球，不考虑地形起伏和建筑物遮挡。
    const ellipsoidCartesian = viewer.camera.pickEllipsoid(click.position)

    // 场景位置 （包含地形/倾斜摄影/模型）
    // 需 globe.depthTestAgainstTerrain = true 才含地形
    if (viewer.scene.globe) viewer.scene.globe.depthTestAgainstTerrain = true
    // pickPosition：从深度缓冲区中获取当前屏幕像素对应的三维位置。
    const sceneCartesian = viewer.scene.pickPosition(click.position)

    // 地表位置（仅地形，不含模型）
    const ray = viewer.camera.getPickRay(click.position)
    const globeCartesian = ray
      ? viewer.scene.globe.pick(ray, viewer.scene)
      : undefined

    clickInfo.value = {
      // 屏幕坐标
      screenX: x,
      screenY: y,
      // 椭球笛卡尔坐标，经过formatCart函数格式化
      ellipsoidCartesian: formatCart(ellipsoidCartesian),
      // 椭球坐标，经过formatDeg函数格式化（度分秒格式）
      ellipsoidDeg: formatDeg(ellipsoidCartesian),
      // 场景笛卡尔坐标，经过formatCart函数格式化
      sceneCartesian: formatCart(sceneCartesian),
      // 场景坐标，经过formatDeg函数格式化（度分秒格式）
      sceneDeg: formatDeg(sceneCartesian),
      // 地球笛卡尔坐标，经过formatCart函数格式化
      globeCartesian: formatCart(globeCartesian),
      // 地球坐标，经过formatDeg函数格式化（度分秒格式）
      globeDeg: formatDeg(globeCartesian),
    }
  }, ScreenSpaceEventType.LEFT_CLICK) // 监听左键点击事件

  return handler
}

// ── 生命周期 ──
onMounted(() => {
  const token = import.meta.env.VITE_CESIUM_TOKEN
  Ion.defaultAccessToken = token

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

  // 默认底图（同 01-cesium-entry）
  const defaultItem = CESIUM_BASEMAP_LIST.find(i => i.id === "mars3d-terrain")!
  defaultItem.activate(viewer).then(() => {
    currentId.value = defaultItem.id
    currentLabel.value = defaultItem.label
  })

  // 飞到北京上空
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 20000000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-87),
      roll: 0,
    },
  })

  // 实时坐标同步
  viewer?.camera.changed.addEventListener(syncCameraToUI)

  // 鼠标拾取
  clickHandler = setupClickHandler()
})

onUnmounted(() => {
  viewer?.camera.changed.removeEventListener(syncCameraToUI)

  if (clickHandler) {
    clickHandler.destroy()
    clickHandler = null
  }

  if (viewer) {
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

/* ── 清除 Cesium 视图底部和工具栏 ── */
:deep(.cesium-viewer-bottom) { display: none !important; }
:deep(.cesium-viewer-toolbar) { display: none !important; }

/* ── 右上角底图控制（同 01-cesium-entry） ── */
.top-right-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

/* ── 左侧面板 ── */
.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 100;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.panel-card {
  --el-card-padding: 12px;
  --el-card-border-radius: 8px;
}

.panel-card :deep(.el-card__header) {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 600;
}

.panel-card :deep(.el-card__body) {
  padding: 12px;
}

/* ── 滑块行 ── */
.slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.slider-row label {
  min-width: 60px;
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

/* ── 按钮行 ── */
.button-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.button-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 8px 4px;
}

/* ── 点击提示 ── */
.click-hint {
  font-size: 13px;
  color: var(--el-text-color-placeholder);
  text-align: center;
  padding: 12px 0;
  margin: 0;
}

/* ── descriptions 代码字体 ── */
code {
  font-size: 11px;
  word-break: break-all;
}
</style>
