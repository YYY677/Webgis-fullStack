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

        <!-- ════════════ 卡片一：GeoJSON ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🗺️ GeoJSON 加载 — <code>GeoJsonDataSource</code></template>

          <p class="card-desc">
            GeoJSON 是 Web GIS 最通用的矢量数据格式。
            GeoJsonDataSource 直接加载并自动转换为 Entity。
          </p>

          <div class="button-row">
            <el-button size="small" :loading="loadingGeo1" @click="loadGeoJSON('cities')">加载省会城市</el-button>
            <el-button size="small" :loading="loadingGeo2" @click="loadGeoJSON('chongqing')">加载重庆县域边界</el-button>
            <el-button size="small" :loading="loadingGeo3" @click="loadGeoJSON('province')">加载省面图</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearCard1">清除数据源</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片二：3D Tiles ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🏗️ 3D Tiles — <code>Cesium3DTileset</code></template>

          <p class="card-desc">
            3D Tiles 是 Cesium 的核心能力，支持海量三维数据的流式加载与 LOD。
            每个 tileset 按树状结构组织，浏览器只加载当前视角需要的瓦片。
          </p>

          <div class="button-row">
            <el-button size="small" :loading="loadingTiles1" @click="loadTileset('buildings')">加载建筑白模</el-button>
            <el-button size="small" :loading="loadingTiles2" @click="loadTileset('oblique')">加载倾斜摄影</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearCard2">清除 3D Tiles</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：glTF 模型 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎲 glTF 模型 — Entity vs Primitive</template>

          <p class="card-desc">
            glTF 是 3D 模型的标准格式（Cesium 创始团队即其作者）。
            .glb 是二进制自包含，.gltf 文本格式可引用外部资源。
            加载方式完全相同。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addModel('feiji')">添加客机</el-button>
            <el-button size="small" @click="addModel('man')">添加人物</el-button>
            <el-button size="small" @click="addModel('wajueji')">添加挖掘机</el-button>
            <el-button size="small" @click="addModel('weixin')">添加卫星</el-button>
            <el-button size="small" @click="addModel('su7')">添加SU7</el-button>
          </div>
          <div class="button-row" style="margin-top: 4px;">
            <el-button size="small" @click="addModelPrimitive">⚡ Primitive 加载客机</el-button>
          </div>
          <div class="toolbar-row" style="margin-top: 4px;">
            <el-button size="small" type="danger" plain @click="clearCard3">清除模型</el-button>
          </div>

          <p v-if="modelInfo" class="model-info">{{ modelInfo }}</p>
        </el-card>

        <!-- ════════════ 卡片四：CZML ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🛰️ CZML 时间动画 — <code>CzmlDataSource</code></template>

          <p class="card-desc">
            CZML 是 Cesium 专有的 JSON 时间序列格式。
            以 "packet" 为单位描述对象，支持位置、姿态、样式随时间变化。
          </p>

          <div class="button-row">
            <el-button size="small" :loading="loadingCzml" @click="loadCZML">加载卫星轨道</el-button>
          </div>
          <div v-if="czmlLoaded" class="clock-controls">
            <span class="clock-label">🕐 {{ clockTime }}</span>
            <el-switch :model-value="clockRunning" size="small" @update:modelValue="toggleClock" />
            <span class="clock-hint">{{ clockRunning ? '运行中' : '已暂停' }}</span>
          </div>
          <div class="toolbar-row" style="margin-top: 6px;">
            <el-button size="small" type="danger" plain @click="clearCard4">清除 CZML</el-button>
          </div>
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
  Color,
  Math as CesiumMath,
  GeoJsonDataSource,
  DataSource,
  Cesium3DTileset,
  Model,
  CzmlDataSource,
  JulianDate,
  Entity,
  Matrix4,
  LabelStyle,
  HeadingPitchRange,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")

// 加载状态，加载时显示loading图标，优化用户等待体验
const loadingGeo1 = ref(false)
const loadingGeo2 = ref(false)
const loadingGeo3 = ref(false)
const loadingTiles1 = ref(false)
const loadingTiles2 = ref(false)
const loadingCzml = ref(false)

// CZML 时钟
const czmlLoaded = ref(false)  // CZML 是否已加载，控制时钟面板显示
const clockRunning = ref(false)// 时钟是否在走
const clockTime = ref("")
let clockTimer: ReturnType<typeof setInterval> | null = null

// 模型提示信息
const modelInfo = ref("")

// ── Cesium 引用 ──
let viewer: Viewer | null = null

/** 恢复默认北京全景视角 */
function resetToDefaultView() {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 10000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

// ── 数据跟踪 ──
const card1DataSources: DataSource[] = []
const card2Tilesets: Cesium3DTileset[] = []
const card3Entities: Entity[] = []
const card3Primitives: any[] = []
const card4DataSources: DataSource[] = []

// ══════════════════════════════════════════
// 卡片一：GeoJSON
// ══════════════════════════════════════════

async function loadGeoJSON(type: "cities" | "chongqing" | "province") {
  if (!viewer) return
  const cfgs: Record<string, { url: string; style: any; view: [number, number, number]; loading: typeof loadingGeo1 }> = {
    cities: {
      url: "/test_data/cities.geojson",
      // Point → billboard（运行时生成圆形贴图）
      style: { markerColor: Color.RED, markerSize: 12 },
      view: [105, 36, 6000000], loading: loadingGeo1,
    },
    chongqing: {
      url: "/test_data/chongqing_county_border.geojson",
      // Polygon → entity.polygon
      // Cesium 在 GeoJsonDataSource 源码里写了硬编码的映射逻辑
      //   fill   → polygon.material（填充色）
      //   stroke → polygon.outlineColor（边线色）
      //   strokeWidth → polygon.outlineWidth（边线宽）
      style: { stroke: Color.YELLOW, strokeWidth: 2, fill: Color.YELLOW.withAlpha(0.05) },
      view: [105, 30, 2000000], loading: loadingGeo2,
    },
    province: {
      url: "/test_data/province_border.geojson",
      style: { stroke: Color.CYAN, strokeWidth: 1.5, fill: Color.CYAN.withAlpha(0.03) },
      view: [105, 35, 7000000], loading: loadingGeo3,
    },
  }
  const cfg = cfgs[type]
  cfg.loading.value = true
  try {
    const ds = await GeoJsonDataSource.load(cfg.url, cfg.style)
    viewer.dataSources.add(ds)
    card1DataSources.push(ds)
    // 省会城市点数据 → 加名称标注
    if (type === "cities") {
      ds.entities.values.forEach(e => {
        const name = e.properties?.name?.getValue(viewer!.clock.currentTime)
        if (name) {
          const label = e as any
          // label 是 Entity 类自带的属性，所有 Entity 都有 label 属性。
          label.label = {
            text: String(name),
            font: "14px sans-serif",
            fillColor: Color.YELLOW,
            outlineColor: Color.BLACK,
            outlineWidth: 1,
            style: LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: { x: 0, y: -22 },
            showBackground: true,
            backgroundColor: Color.BLACK.withAlpha(0.4),
          }
        }
      })
    }
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(cfg.view[0], cfg.view[1], cfg.view[2]),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.0,
    })
  } catch (e: any) {
    ElMessage.error(`GeoJSON 加载失败: ${e.message}`)
  } finally {
    cfg.loading.value = false
  }
}

function clearCard1() {
  if (!viewer) return
  card1DataSources.forEach(ds => viewer!.dataSources.remove(ds))
  card1DataSources.length = 0
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片二：3D Tiles
// ══════════════════════════════════════════

async function loadTileset(type: "buildings" | "oblique") {
  if (!viewer) return
  const url = type === "buildings"
    ? "/cesium-data/tiles-buildings/tileset.json"
    : "/cesium-data/tiles-oblique/tileset.json"
  const loading = type === "buildings" ? loadingTiles1 : loadingTiles2
  loading.value = true
  try {
    const tileset = await Cesium3DTileset.fromUrl(url)
    viewer.scene.primitives.add(tileset)
    card2Tilesets.push(tileset)
    // viewer.camera.flyTo({ destination }) → 用绝对坐标，你必须知道经纬度高度
    // viewer.flyTo(target, { offset }) → 用相对坐标，Cesium 从 target 的包围盒算出中心，再按 offset 算相机位置
    // offset 控制飞到 tileset 后的视角：heading=0°（正北）、pitch=-35°（俯视）、range=到目标的距离（米）
    viewer.flyTo(tileset, {
      offset: new HeadingPitchRange(
        CesiumMath.toRadians(0),
        CesiumMath.toRadians(-35),
        2000,
      ),
      duration: 1.0,
    })
  } catch (e: any) {
    ElMessage.error(`3D Tiles 加载失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

function clearCard2() {
  if (!viewer) return
  card2Tilesets.forEach(t => viewer!.scene.primitives.remove(t))
  card2Tilesets.length = 0
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片三：glTF 模型
// ══════════════════════════════════════════

/** Entity 方式加载单个模型 */
function addModel(type: string) {
  if (!viewer) return
  // 模型沿同一纬度（40.0）排成一行，间距约 0.6°，浮空 500m
  // scale 倍数：每个模型原始文件的设计尺寸不同，需要单独调整使它们视觉上大小相近
  const configs: Record<string, { path: string; pos: [number, number, number]; scale: number; label: string }> = {
    feiji: { path: "/cesium-data/models/feiji.glb", pos: [115.5, 40.0, 50000], scale: 100, label: "客机" },
    man: { path: "/cesium-data/models/Man.glb", pos: [116.1, 40.0, 50000], scale: 8000, label: "人物" },
    wajueji: { path: "/cesium-data/models/wajueji.glb", pos: [116.7, 40.0, 50000], scale: 8000, label: "挖掘机" },
    weixin: { path: "/cesium-data/models/weixin.gltf", pos: [117.3, 40.0, 50000], scale: 800, label: "卫星" },
    // 文件夹格式 gltf：路径指向 scene.gltf，Cesium 自动加载同目录的 .bin 和 textures/
    su7: { path: "/cesium-data/models/su7/scene.gltf", pos: [117.9, 40.0, 50000], scale: 8000, label: "SU7" },
  }
  const c = configs[type]
  if (!c) return

  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(c.pos[0], c.pos[1], c.pos[2]),
    model: { uri: c.path, scale: c.scale },
    label: {
      text: c.label,
      font: "14px sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 1,
      style: LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: { x: 0, y: -40 } as any,
      showBackground: true,
      backgroundColor: Color.BLACK.withAlpha(0.5),
    },
  })
  card3Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.7, 40.0, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
  modelInfo.value = `已添加 ${c.label}（Entity 方式）`
}

/** Primitive 方式加载同一个飞机模型 */
async function addModelPrimitive() {
  if (!viewer) return
  try {
    const position = Cartesian3.fromDegrees(118.2, 40.0, 50000)
    // Primitive 没有 position，用 modelMatrix 把模型从原点平移到目标位置
    const model = await Model.fromGltfAsync({
      url: "/cesium-data/models/feiji.glb",
      modelMatrix: Matrix4.fromTranslation(position),
      scale: 100,
    })
    viewer.scene.primitives.add(model)
    card3Primitives.push(model)
    // 加个文字标签辅助识别
    const label = viewer.entities.add({
      position,
      label: {
        text: "客机（Primitive）",
        font: "14px sans-serif",
        fillColor: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 1,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: { x: 0, y: -40 } as any,
        showBackground: true,
        backgroundColor: Color.BLACK.withAlpha(0.5),
      },
    })
    // 把 label 也跟踪起来以便清除（加入 card3Entities）
    card3Entities.push(label)
    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(117.7, 40.0, 200000),
      orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
      duration: 1.0,
    })
    modelInfo.value = "已添加客机（Primitive 方式）"
  } catch (e: any) {
    ElMessage.error(`Primitive 模型加载失败: ${e.message}`)
  }
}

function clearCard3() {
  if (!viewer) return
  card3Entities.forEach(e => viewer!.entities.remove(e))
  card3Entities.length = 0
  card3Primitives.forEach(p => viewer!.scene.primitives.remove(p))
  card3Primitives.length = 0
  modelInfo.value = ""
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片四：CZML
// ══════════════════════════════════════════

async function loadCZML() {
  if (!viewer) return
  loadingCzml.value = true
  try {
    // CZML 是 Cesium 发明的 JSON 格式，专门描述"随时间变化的对象"。
    // 一个典型 CZML 描述的是：卫星在什么时间点飞到什么位置、姿态怎么转、图标显示什么、轨道线怎么画。
    // 绝大部分 WebGIS 项目（智慧城市、城管、自然资源、土地利用）几乎用不到它。

    // CZML 里的定义：
    // { "clock": {
    //     "interval": "2023-05-10T00:00:00Z/2023-05-11T00:00:00Z",
    //     "currentTime": "2023-05-10T00:00:00Z",
    //     "multiplier": 60
    // }}

    // // 加载后等价于：
    // viewer.clock.startTime = 2023-05-10    // CZML interval 开始
    // viewer.clock.stopTime  = 2023-05-11    // CZML interval 结束
    // viewer.clock.currentTime = 2023-05-10  // CZML currentTime
    // viewer.clock.multiplier = 60           // 60 倍速播放

    const ds = await CzmlDataSource.load("/cesium-data/wx.czml")
    viewer.dataSources.add(ds)
    card4DataSources.push(ds)
    // shouldAnimate = true 让仿真时间自动向前走，卫星沿轨道运动
    // shouldAnimate = false 则时间冻结，卫星停在原地
    viewer.clock.shouldAnimate = true
    czmlLoaded.value = true
    clockRunning.value = true
    // 更新时钟显示
    if (clockTimer) clearInterval(clockTimer)
    // 这个时间是 CZML 文件里定义的仿真时钟时间，不是真实时间
    // wx.czml 的时钟范围是 2023-05-10 ~ 2023-05-11，multiplier=60 即 60 倍速播放
    clockTimer = setInterval(() => {
      if (!viewer) return
      clockTime.value = JulianDate.toDate(viewer.clock.currentTime).toISOString().replace("T", " ").slice(0, 19)
    }, 500)
    // 飞入视角
    viewer.flyTo(ds)
  } catch (e: any) {
    ElMessage.error(`CZML 加载失败: ${e.message}`)
  } finally {
    loadingCzml.value = false
  }
}

function toggleClock(running: boolean) {
  if (!viewer) return
  viewer.clock.shouldAnimate = running
  clockRunning.value = running
}

function clearCard4() {
  if (!viewer) return
  card4DataSources.forEach(ds => viewer!.dataSources.remove(ds))
  card4DataSources.length = 0
  viewer.clock.shouldAnimate = false
  czmlLoaded.value = false
  clockRunning.value = false
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
  clockTime.value = ""
  resetToDefaultView()
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
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (viewer) {
    // 清除所有跟踪的数据
    card1DataSources.forEach(ds => viewer!.dataSources.remove(ds))
    card2Tilesets.forEach(t => viewer!.scene.primitives.remove(t))
    card3Entities.forEach(e => viewer!.entities.remove(e))
    card3Primitives.forEach(p => viewer!.scene.primitives.remove(p))
    card4DataSources.forEach(ds => viewer!.dataSources.remove(ds))
    card1DataSources.length = 0
    card2Tilesets.length = 0
    card3Entities.length = 0
    card3Primitives.length = 0
    card4DataSources.length = 0
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
  padding: 12px;
}

.card-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  margin: 0 0 10px;
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

.toolbar-row {
  display: flex;
  gap: 6px;
}

.toolbar-row .el-button {
  flex: 1;
  font-size: 12px;
  padding: 6px 4px;
}

.model-info {
  margin: 6px 0 0;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
}

.clock-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 6px 8px;
  background: var(--el-color-info-light-9);
  border-radius: 4px;
  font-size: 12px;
}

.clock-label {
  font-family: monospace;
  font-size: 11px;
  flex: 1;
}

.clock-hint {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}
</style>
