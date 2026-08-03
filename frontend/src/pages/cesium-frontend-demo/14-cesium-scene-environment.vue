<template>
  <div id="cesiumContainer" class="map-container" :class="{ 'single-image-background-enabled': singleImageBackground }">
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
          <el-radio-group v-model="skyBoxMode" size="small" :disabled="singleImageBackground" @change="applySkyBox">
            <el-radio-button value="default">Cesium 默认</el-radio-button>
            <el-radio-button value="tycho">Tycho 六面图</el-radio-button>
            <el-radio-button value="classic">经典六面图</el-radio-button>
            <el-radio-button value="av9">AV9 六面图</el-radio-button>
            <el-radio-button value="none">关闭</el-radio-button>
          </el-radio-group>
          <p class="tip">普通 <code>SkyBox</code> 使用 6 张图片围成立方体。本项目已保留参考项目的完整 SkyBox 资源；近地天空盒需要额外辅助实现，暂不混入本页。</p>
        </el-card>

        <el-card shadow="never" class="panel-card">
          <template #header>近地背景：单图替代方案</template>
          <div class="switch-row">
            <span>启用 backGroundImg</span>
            <el-switch v-model="singleImageBackground" @change="applySingleImageBackground" />
          </div>
          <p class="tip"><code>backGroundImg.jpg</code> 是一张静态背景图，不是 Cubemap。开启后，Cesium 画布改为透明并暂时隐藏普通天空盒和天空大气，让图片从画布后方露出；关闭后恢复当前选择的天空盒。</p>
          <p class="tip">它适合学习“背景层”思路，但不会随观察方向产生正确的 360° 透视。真正的近地天空盒仍需六张方向图，并重写或扩展 SkyBox 的渲染逻辑。</p>
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
          <div class="slider-row"><span>雾密度</span><el-slider v-model="fogDensity" :min="0.0005" :max="0.003"
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
import { publicUrl } from "@/utils/public-url"

type LocalSkyBoxMode = "tycho" | "classic" | "av9"
type SkyBoxMode = "default" | LocalSkyBoxMode | "none"
type SceneModeName = "SCENE2D" | "COLUMBUS_VIEW" | "SCENE3D"
type SkyBoxSources = {
  positiveX: string
  negativeX: string
  positiveY: string
  negativeY: string
  positiveZ: string
  negativeZ: string
}

const SKY_BOX_SOURCES: Record<LocalSkyBoxMode, SkyBoxSources> = {
  // Cesium 的 SkyBox API 固定使用 positive/negative X、Y、Z 这六个 key，不能改成 front、left 等名字。
  // Tycho 与 Cesium 内置默认天空使用同源贴图；保留它是为了演示“本地文件 SkyBox”的写法。
  tycho: {
    positiveX: publicUrl("cesium-data/skybox/tycho2t3_80_px.jpg"), negativeX: publicUrl("cesium-data/skybox/tycho2t3_80_mx.jpg"),
    positiveY: publicUrl("cesium-data/skybox/tycho2t3_80_py.jpg"), negativeY: publicUrl("cesium-data/skybox/tycho2t3_80_my.jpg"),
    positiveZ: publicUrl("cesium-data/skybox/tycho2t3_80_pz.jpg"), negativeZ: publicUrl("cesium-data/skybox/tycho2t3_80_mz.jpg"),
  },
  classic: {
    positiveX: publicUrl("cesium-data/skybox/Right.jpg"), negativeX: publicUrl("cesium-data/skybox/Left.jpg"),
    positiveY: publicUrl("cesium-data/skybox/Up.jpg"), negativeY: publicUrl("cesium-data/skybox/Down.jpg"),
    positiveZ: publicUrl("cesium-data/skybox/Front.jpg"), negativeZ: publicUrl("cesium-data/skybox/Back.jpg"),
  },
  av9: {
    positiveX: publicUrl("cesium-data/skybox/rightav9.jpg"), negativeX: publicUrl("cesium-data/skybox/leftav9.jpg"),
    positiveY: publicUrl("cesium-data/skybox/topav9.jpg"), negativeY: publicUrl("cesium-data/skybox/bottomav9.jpg"),
    positiveZ: publicUrl("cesium-data/skybox/frontav9.jpg"), negativeZ: publicUrl("cesium-data/skybox/backav9.jpg"),
  },
}

function formatSceneExportName(date: Date) {
  const parts = [
    date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(),
    date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(),
  ].map((part) => String(part).padStart(2, "0"))
  return `cesium-scene-${parts.slice(0, 3).join("")}-${parts.slice(3).join("")}.png`
}

function getSceneModeLabel(mode: SceneModeName) {
  return {
    SCENE2D: "2D 地图",
    COLUMBUS_VIEW: "2.5D 哥伦布视图",
    SCENE3D: "3D 地球",
  }[mode]
}

const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
// 天空盒模式：默认、关闭、自定义。
const skyBoxMode = ref<SkyBoxMode>("default")
// 场景模式：2D、2.5D、3D。Cesium 默认 3D。
const sceneMode = ref<SceneModeName>("SCENE3D")
// 大气层是否可见；Cesium 默认开启。
const atmosphere = ref(true)
// 雾是否可见；Cesium 默认关闭。
const fog = ref(false)
const fogDensity = ref(0.0012)
const backgroundColor = ref("#071126")
// 单张背景图默认关闭。它不是 SkyBox，因此需要让 WebGL 画布透明后才能在 canvas 后方看见。
const singleImageBackground = ref(false)

let viewer: Viewer | null = null
// Viewer 创建时自带默认 SkyBox；三套本地主题各自缓存一个实例，便于重复切换。
let defaultSkyBox: SkyBox | undefined
// localSkyBoxes 记录三套本地主题的 SkyBox 实例，按主题复用。
// 每个实例都占用 GPU Cube Map 纹理资源，切换时不销毁旧实例。
// Partial的作用是让Record的值可以为undefined，因为页面刚打开时，三套天空盒都还没创建。
let localSkyBoxes: Partial<Record<LocalSkyBoxMode, SkyBox>> = {}
// 按主题保存已经创建的 SkyBox：再次切回该主题时，六张图和对应的 GPU Cube Map 都会被复用。

function destroySkyBox(skyBox?: SkyBox) {
  if (skyBox && !skyBox.isDestroyed()) skyBox.destroy()
}

function replaceSceneSkyBox(nextSkyBox?: SkyBox) {
  if (!viewer || viewer.scene.skyBox === nextSkyBox) return
  // 这里只替换场景引用，不销毁旧实例；它仍留在 localSkyBoxes 中，供下一次切换复用。
  // Scene 不会因属性赋值自动销毁被替换的 SkyBox。
  // 三套本地实例在页面卸载时再统一释放 GPU 纹理资源。
  viewer.scene.skyBox = nextSkyBox
}

function getLocalSkyBox(mode: LocalSkyBoxMode) {
  // 优先从缓存中取出已经创建的 SkyBox 实例；若没有就创建一个新的。
  let skyBox = localSkyBoxes[mode]
  if (!skyBox || skyBox.isDestroyed()) {
    skyBox = new SkyBox({ sources: SKY_BOX_SOURCES[mode] })
    localSkyBoxes[mode] = skyBox
  }
  return skyBox
}

function applySkyBox() {
  if (!viewer) return
  // 单图背景通过 CSS 位于 canvas 后方；保留任何 SkyBox 都会把它完全盖住。
  if (singleImageBackground.value) {
    replaceSceneSkyBox(undefined)
    return
  }
  if (skyBoxMode.value === "none") {
    replaceSceneSkyBox(undefined)
  } else if (skyBoxMode.value === "default") {
    replaceSceneSkyBox(defaultSkyBox)
    if (viewer.scene.skyBox) viewer.scene.skyBox.show = true
  } else {
    replaceSceneSkyBox(getLocalSkyBox(skyBoxMode.value))
  }
}

function applyEnvironment() {
  if (!viewer) return
  // skyAtmosphere 可能因 Viewer 配置不存在，故需要守卫；fog 则始终属于 Scene。
  // 开启单图背景时隐藏大气层，否则大气渲染仍会覆盖画布后的图片。
  if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = singleImageBackground.value ? false : atmosphere.value
  viewer.scene.fog.enabled = fog.value
  viewer.scene.fog.density = fogDensity.value
  // backgroundColor 是 canvas 最先清除时使用的“兜底色”，不是地球或影像的底色。
  // 只有像素没有被 SkyBox、天空大气、地球或其他对象覆盖时才能看见；本页默认 SkyBox 与大气都开启，
  // 因而改它通常无明显变化。要观察效果：关闭天空盒和天空大气，再看地球外的空白区域。
  viewer.scene.backgroundColor = singleImageBackground.value
    ? Color.TRANSPARENT // 开启单图背景时让 canvas 透明，才能透过它看到 CSS 背景图。
    : Color.fromCssColorString(backgroundColor.value)
}

function applySingleImageBackground() {
  // 用同一套状态推导场景：开启时清空 SkyBox、隐藏大气并透明；关闭时恢复用户原本选中的主题和大气开关。
  applySkyBox()
  applyEnvironment()
}

function setSceneMode(mode: SceneModeName) {
  if (!viewer) return
  // 第二个参数是形态转换动画时长。0 表示立即切换，避免教学控件在中间状态停留。
  if (mode === "SCENE2D") viewer.scene.morphTo2D(1)
  if (mode === "COLUMBUS_VIEW") viewer.scene.morphToColumbusView(1)
  if (mode === "SCENE3D") viewer.scene.morphTo3D(1)
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
    // alpha: true 允许清屏色为透明，CSS 背景图才能透过 canvas 显示；PNG 导出所需的 preserveDrawingBuffer 仍保留。
    contextOptions: { webgl: { preserveDrawingBuffer: true, alpha: true } },
  })
  defaultSkyBox = viewer.scene.skyBox
  const defaultItem = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  defaultItem.activate(viewer).then(() => { currentId.value = defaultItem.id; currentLabel.value = defaultItem.label })
  applyEnvironment()
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.4, 39.9, 26000000) })
})

onUnmounted(() => {
  const activeSkyBox = viewer?.scene.skyBox
  // 当前附着的 skyBox 会在 viewer.destroy() 中释放；这里只有“已经被替换掉”的实例需要手动释放。
  if (defaultSkyBox !== activeSkyBox) destroySkyBox(defaultSkyBox)
  Object.values(localSkyBoxes).forEach((skyBox) => {
    if (skyBox !== activeSkyBox) destroySkyBox(skyBox)
  })
  if (viewer) viewer.destroy()
  viewer = null
  defaultSkyBox = undefined
  localSkyBoxes = {}
})
</script>

<style scoped>
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

/* 这张图是普通二维背景，放在 Cesium canvas 的下层；不是以三维方向采样的天空盒。 */
.map-container.single-image-background-enabled {
  background: center / cover no-repeat url("/cesium-data/skybox/backGroundImg.jpg");
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
