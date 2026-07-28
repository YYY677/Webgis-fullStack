<template>
  <div id="cesiumContainer" class="map-container">
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />
    <div class="top-right-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="panelOpen = $event" />
    </div>
    <div class="basemap-label">{{ currentLabel }}</div>

    <div class="left-panel" @click.stop>
      <el-scrollbar max-height="calc(100vh - 80px)">
        <el-card shadow="never" class="panel-card">
          <template #header>14 · 场景环境与出图</template>
          <p class="card-desc">这里操作的是 <code>scene</code> 而不是 Entity、Primitive 或模型：天空、场景模式、雾和 canvas 导出都属于全局场景能力。</p>
          <el-button type="primary" size="small" @click="exportScene">导出当前 PNG</el-button>
          <p class="tip">Viewer 用 <code>preserveDrawingBuffer</code> 创建，导出前显式渲染一帧，避免下载黑图。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>天空盒</template>
          <el-radio-group v-model="skyBoxMode" size="small" @change="applySkyBox">
            <el-radio-button value="default">Cesium 默认</el-radio-button>
            <el-radio-button value="custom">本地六面图</el-radio-button>
            <el-radio-button value="none">关闭</el-radio-button>
          </el-radio-group>
          <p class="tip">普通 <code>SkyBox</code> 使用 6 张图片围成立方体。本项目已保留参考项目的完整 SkyBox 资源；近地天空盒需要额外辅助实现，暂不混入本页。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>视图模式 · {{ getSceneModeLabel(sceneMode) }}</template>
          <el-button-group>
            <el-button :type="sceneMode === 'SCENE2D' ? 'primary' : 'default'" size="small"
              @click="setSceneMode('SCENE2D')">2D</el-button>
            <el-button :type="sceneMode === 'COLUMBUS_VIEW' ? 'primary' : 'default'" size="small"
              @click="setSceneMode('COLUMBUS_VIEW')">2.5D</el-button>
            <el-button :type="sceneMode === 'SCENE3D' ? 'primary' : 'default'" size="small"
              @click="setSceneMode('SCENE3D')">3D</el-button>
          </el-button-group>
          <p class="tip">天空盒主要在 3D 地球模式中观察；2D 与 2.5D 的相机和投影行为不同。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>大气、背景与雾</template>
          <div class="switch-row"><span>天空大气</span><el-switch v-model="atmosphere" @change="applyEnvironment" /></div>
          <div class="switch-row"><span>基础雾效</span><el-switch v-model="fog" @change="applyEnvironment" /></div>
          <div class="color-row"><span>背景颜色</span><el-color-picker v-model="backgroundColor" show-alpha
              @change="applyEnvironment" /></div>
          <div class="slider-row"><span>雾密度</span><el-slider v-model="fogDensity" :min="0.00005" :max="0.001"
              :step="0.00005" :disabled="!fog" @change="applyEnvironment" /><strong>{{ fogDensity.toFixed(5) }}</strong>
          </div>
        </el-card>
      </el-scrollbar>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue"
import { Cartesian3, Color, Ion, SkyBox, Viewer } from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import {
  createSkyBoxSources,
  formatSceneExportName,
  getSceneModeLabel,
} from "@/utils/cesium-rendering"
import type { SceneModeName } from "@/utils/cesium-rendering"

type SkyBoxMode = "default" | "custom" | "none"

const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
const skyBoxMode = ref<SkyBoxMode>("default")
const sceneMode = ref<SceneModeName>("SCENE3D")
const atmosphere = ref(true)
const fog = ref(false)
const fogDensity = ref(0.00025)
const backgroundColor = ref("#071126")

let viewer: Viewer | null = null
// Viewer 创建时自带默认 SkyBox。保存引用后，才能在“关闭/自定义”之间切回原始天空盒。
let defaultSkyBox: SkyBox | undefined
let customSkyBox: SkyBox | undefined

function destroySkyBox(skyBox?: SkyBox) {
  if (skyBox && !skyBox.isDestroyed()) skyBox.destroy()
}

function replaceSceneSkyBox(nextSkyBox?: SkyBox) {
  if (!viewer || viewer.scene.skyBox === nextSkyBox) return
  const previousSkyBox = viewer.scene.skyBox
  // Scene 不会因一次属性赋值自动销毁被替换的 SkyBox；
  // 自定义实例已不再被场景引用时，需要主动释放其 GPU 纹理资源。
  viewer.scene.skyBox = nextSkyBox
  if (previousSkyBox === customSkyBox) {
    destroySkyBox(customSkyBox)
    customSkyBox = undefined
  }
}

function applySkyBox() {
  if (!viewer) return
  if (skyBoxMode.value === "custom") {
    // 每张立方体贴图都应对应一个 SkyBox 实例；createSkyBoxSources 提供六个朝向的图片。
    const nextSkyBox = new SkyBox({ sources: createSkyBoxSources() })
    replaceSceneSkyBox(nextSkyBox)
    customSkyBox = nextSkyBox
  } else if (skyBoxMode.value === "none") {
    replaceSceneSkyBox(undefined)
  } else {
    replaceSceneSkyBox(defaultSkyBox)
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = true
  }
}

function applyEnvironment() {
  if (!viewer) return
  // skyAtmosphere 可能因 Viewer 配置不存在，故需要守卫；fog 则始终属于 Scene。
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = atmosphere.value
  viewer.scene.fog.enabled = fog.value
  viewer.scene.fog.density = fogDensity.value
  viewer.scene.backgroundColor = Color.fromCssColorString(backgroundColor.value)
}

function setSceneMode(mode: SceneModeName) {
  if (!viewer) return
  // 第二个参数是形态转换动画时长。0 表示立即切换，避免教学控件在中间状态停留。
  if (mode === "SCENE2D") viewer.scene.morphTo2D(0)
  if (mode === "COLUMBUS_VIEW") viewer.scene.morphToColumbusView(0)
  if (mode === "SCENE3D") viewer.scene.morphTo3D(0)
  sceneMode.value = mode
}

function exportScene() {
  if (!viewer) return
  // 先显式渲染一帧，再读取 canvas；否则按需渲染场景可能导出上一帧或空白画面。
  viewer.scene.render()
  const link = document.createElement("a")
  link.href = viewer.scene.canvas.toDataURL("image/png")
  link.download = formatSceneExportName(new Date())
  link.click()
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return
  await item.activate(viewer)
  currentId.value = item.id
  currentLabel.value = item.label
}

onMounted(() => {
  Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN
  viewer = new Viewer("cesiumContainer", {
    baseLayer: false, baseLayerPicker: false, animation: false, timeline: false,
    fullscreenButton: false, navigationHelpButton: false, homeButton: false, projectionPicker: false,
    // 默认 WebGL 在展示后可丢弃绘图缓冲区以获得更好性能。
    // 导出 PNG 必须保留它，代价是更多显存和潜在渲染开销。
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
  })
  defaultSkyBox = viewer.scene.skyBox
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  defaultItem.activate(viewer).then(() => { currentId.value = defaultItem.id; currentLabel.value = defaultItem.label })
  applyEnvironment()
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.4, 39.9, 26_000) })
})

onUnmounted(() => {
  const activeSkyBox = viewer?.scene.skyBox
  // 当前附着的 skyBox 会在 viewer.destroy() 中释放；这里只有“已经被替换掉”的实例需要手动释放。
  if (defaultSkyBox !== activeSkyBox) destroySkyBox(defaultSkyBox)
  if (customSkyBox !== activeSkyBox) destroySkyBox(customSkyBox)
  if (viewer) viewer.destroy()
  viewer = null
  defaultSkyBox = undefined
  customSkyBox = undefined
})
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

:deep(.cesium-viewer-bottom),
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
  left: 16px;
  bottom: 16px;
  z-index: 100;
  padding: 4px 12px;
  border-radius: 4px;
  color: #fff;
  background: rgba(0, 0, 0, .55);
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

.card-desc,
.tip {
  margin: 0 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.tip {
  margin: 10px 0 0;
  font-size: 11px;
}

.switch-row,
.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}

.slider-row {
  display: grid;
  grid-template-columns: 54px 1fr 62px;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
}

.slider-row strong {
  color: var(--el-color-primary);
  font: 11px Consolas, monospace;
  text-align: right;
}
</style>
