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

        <!-- ════════════ 卡片一：基础几何体 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🔺 基础几何体 — GeometryInstance + Appearance</template>

          <p class="card-desc">
            Primitive = GeometryInstance（几何数据）+ Appearance（渲染样式）。
            同一个 Primitive 可包含多个 GeometryInstance，共用渲染状态。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addTriangle">🔺 创建三角形</el-button>
            <el-button size="small" @click="addRectPrimitive">▭ 创建矩形</el-button>
            <el-button size="small" @click="addBoxPrimitive">🧊 创建立方体</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearCard1">清除几何体</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片二：材质外观 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎨 材质外观 — MaterialAppearance</template>

          <p class="card-desc">
            Material.fromType() 提供内置材质（棋盘格、条纹、网格等），
            MaterialAppearance 将这些材质应用到几何体表面。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addCheckerboard">🏁 棋盘格多边形</el-button>
            <el-button size="small" @click="addStripeCircle">〰️ 条纹圆形</el-button>
            <el-button size="small" @click="addGridRect">#️⃣ 网格面</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearCard2">清除材质几何体</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：Entity vs Primitive ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>⚡ Entity vs Primitive 性能对照</template>

          <p class="card-desc">
            Entity 是高层次 API，每个 entity 独立渲染；
            Primitive 共享 Geometry + Appearance，大批量时性能优势明显。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addEntityPolygon">Entity 多边形</el-button>
            <el-button size="small" @click="addPrimitivePolygon">Primitive 多边形</el-button>
          </div>
          <div class="button-row">
            <el-button size="small" @click="batchEntity">批量 Entity ×1000</el-button>
            <el-button size="small" @click="batchPrimitive">批量 Primitive ×1000</el-button>
          </div>

          <div v-if="perfResult" class="perf-result">
            <div>Entity 耗时：<strong>{{ perfResult.entityMs }}</strong> ms</div>
            <div>Primitive 耗时：<strong>{{ perfResult.primitiveMs }}</strong> ms</div>
            <div v-if="perfResult.entityMs && perfResult.primitiveMs" class="perf-speedup">
              Primitive 快约 {{ (perfResult.entityMs / perfResult.primitiveMs).toFixed(1) }} 倍
            </div>
          </div>

          <div class="toolbar-row" style="margin-top: 6px;">
            <el-button size="small" type="danger" plain @click="clearCard3">清除对照</el-button>
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
  Primitive,
  GeometryInstance,
  PerInstanceColorAppearance,
  MaterialAppearance,
  PolygonGeometry,
  RectangleGeometry,
  CircleGeometry,
  BoxGeometry,
  Material,
  Cartesian3,
  Color,
  Rectangle,
  ColorGeometryInstanceAttribute,
  Matrix4,
  Entity,
  VertexFormat,
  Math as CesiumMath,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"

// ── UI 状态 ──
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("")
const perfResult = ref<{ entityMs: number; primitiveMs: number } | null>(null)

// ── Cesium 引用 ──
let viewer: Viewer | null = null
let defaultCamRestored = false // 标记默认视角是否已恢复，防止多次 setView

// ── Primitives 跟踪 ──
/** 卡片一的 primitive 列表 */
const card1Primitives: Primitive[] = []
/** 卡片二的 primitive 列表 */
const card2Primitives: Primitive[] = []
/** 卡片三的 primitive + entity 引用 */
const card3Primitives: Primitive[] = []
// 跟踪卡片三里所有 entity（addEntityPolygon 和 batchEntity 创建的都往里塞），供 clearCard3() 一键全清。
const card3Entities: Entity[] = []
/** 卡片三 Entity 批量结果 */
let card3EntityBatch: Entity[] = []
/** 卡片三 Primitive 批量结果（仅批量创建的 primitive，不含单多边形） */
let card3PrimitiveBatch: Primitive[] = []

// ── 工具 ──

/** 恢复默认北京全景视角 */
function resetToDefaultView() {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 10000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

/**
 * 便捷创建单个 Primitive
 * geometry 已构造好的 Geometry 对象，appearance 已构造好的 Appearance 对象
 * 颜色 color（可选）传给 ColorGeometryInstanceAttribute
 */
function createPrimitive(
  geometry: any,
  appearance: any,
  color?: Color,
): Primitive {
  const attrs: any = {}
  if (color) {
    attrs.color = ColorGeometryInstanceAttribute.fromColor(color)
  }
  const instance = new GeometryInstance({ geometry, attributes: attrs })
  const primitive = new Primitive({ geometryInstances: instance, appearance })
  viewer!.scene.primitives.add(primitive)
  return primitive
}

// ══════════════════════════════════════════
// 卡片一：基础几何体
// ══════════════════════════════════════════
// Geometry 决定“形状”，
// GeometryInstance 决定“实例属性”，
// Appearance 决定“怎么渲染”，
// Primitive负责提交GPU。
function addTriangle() {
  if (!viewer) return
  const geometry = PolygonGeometry.fromPositions({
    // position绘制适合任意多边形。
    positions: Cartesian3.fromDegreesArray([
      115.5, 38.5,
      117.5, 38.5,
      116.5, 40.0,
    ]),
    // vertexFormat：顶点格式设置，包含了渲染时所需的顶点数据格式信息，如位置、法线、纹理坐标、颜色等属性
    // position（位置）：表示每个顶点需要三维坐标，几乎所有Geometry都需要。
    // normal（法线）：表示这个面朝哪个方向，用于光照计算，影响渲染的明暗效果。
    // st（纹理坐标）：表示顶点在纹理图像上的位置，用于贴图渲染。
    // color（颜色）：表示顶点的颜色信息，用于PerInstanceColorAppearance渲染。
    // tangent（切线）：表示顶点的切线方向，用于法线贴图渲染。正常情况用不到。
    // 
    // PerInstanceColorAppearance.VERTEX_FORMAT	  用于：纯颜色Primitive。
    // MaterialAppearance.VERTEX_FORMAT	          用于：材质渲染。
    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT, // 等价于position:true，normal:true，没有颜色。
  })
  // appearance 决定渲染方式，PerInstanceColorAppearance 用于每个实例化几何体使用不同颜色渲染。
  // PerInstanceColorAppearance 设计为读取 GeometryInstance 上的颜色属性，而不是读取每个顶点的 color 属性。
  // flat: true — 平面着色，每个面用统一颜色，不插值光照。多边形棱角分明。
  // flat: false（默认）— 光滑着色，在顶点算光照，顶点间颜色渐变插值，曲面物体更平滑。
  // translucent: true — 开启透明渲染通道。颜色带 alpha 时必须有这个。
  const appearance = new PerInstanceColorAppearance({ flat: true, translucent: false })
  const p = createPrimitive(geometry, appearance, Color.RED)
  card1Primitives.push(p)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.17, 39.0, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addRectPrimitive() {
  if (!viewer) return
  const geometry = new RectangleGeometry({
    rectangle: Rectangle.fromDegrees(115.0, 38.5, 117.5, 40.0),
    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
  })
  const appearance = new PerInstanceColorAppearance({ translucent: true })
  const p = createPrimitive(geometry, appearance, Color.GREEN.withAlpha(0.6))
  card1Primitives.push(p)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.25, 39.25, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addBoxPrimitive() {
  if (!viewer) return
  const geometry = new BoxGeometry({
    minimum: new Cartesian3(-100000, -100000, -100000),
    maximum: new Cartesian3(100000, 100000, 100000),
    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
  })
  const position = Cartesian3.fromDegrees(115.0, 41.0, 300000)
  const instance = new GeometryInstance({
    geometry,
    // modelMatrix 用于将几何体从局部坐标系转换到世界坐标系，Geometry本身默认在世界原点(0,0,0)。
    // 通过 Matrix4.fromTranslation(position) 创建一个平移矩阵，将几何体移动到指定的经纬度位置。
    modelMatrix: Matrix4.fromTranslation(position),
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(Color.BLUE.withAlpha(0.7)),
    },
  })
  const appearance = new PerInstanceColorAppearance({ translucent: true })
  const primitive = new Primitive({ geometryInstances: instance, appearance })
  viewer.scene.primitives.add(primitive)
  card1Primitives.push(primitive)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.0, 35.0, 2000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-65), roll: 0 },
    duration: 1.0,
  })
}

function clearCard1() {
  if (!viewer) return
  card1Primitives.forEach(p => viewer!.scene.primitives.remove(p))
  card1Primitives.length = 0
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片二：材质外观 — MaterialAppearance
// ══════════════════════════════════════════

function addCheckerboard() {
  if (!viewer) return
  const geometry = PolygonGeometry.fromPositions({
    positions: Cartesian3.fromDegreesArray([
      115.0, 38.5,
      117.0, 38.5,
      116.5, 40.0,
      115.5, 40.0,
    ]),
    // VertexFormat.DEFAULT也包含了position、normal、st属性，与下面等价。
    vertexFormat: new VertexFormat({ position: true, normal: true, st: true }),
  })
  // MaterialAppearance()需要顶点有position（位置）、normal（法线）属性、st（纹理坐标）属性
  const appearance = new MaterialAppearance({
    material: Material.fromType("Checkerboard"),
    translucent: false,
  })
  const p = createPrimitive(geometry, appearance)
  card2Primitives.push(p)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.0, 39.25, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addStripeCircle() {
  if (!viewer) return
  const geometry = new CircleGeometry({
    center: Cartesian3.fromDegrees(117.5, 40.0),
    radius: 80000,
    vertexFormat: new VertexFormat({ position: true, normal: true, st: true }),
  })
  const appearance = new MaterialAppearance({
    material: Material.fromType("Stripe"),
    translucent: false,
  })
  const p = createPrimitive(geometry, appearance)
  card2Primitives.push(p)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.5, 40.0, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addGridRect() {
  if (!viewer) return
  const geometry = new RectangleGeometry({
    rectangle: Rectangle.fromDegrees(114.0, 39.0, 116.5, 41.0),
    vertexFormat: new VertexFormat({ position: true, normal: true, st: true }),
  })
  const appearance = new MaterialAppearance({
    material: Material.fromType("Grid"),
    translucent: false,
  })
  const p = createPrimitive(geometry, appearance)
  card2Primitives.push(p)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(114.25, 40.0, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function clearCard2() {
  if (!viewer) return
  card2Primitives.forEach(p => viewer!.scene.primitives.remove(p))
  card2Primitives.length = 0
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片三：Entity vs Primitive 对照
// ══════════════════════════════════════════

/** 设置卡片三的固定视角（不随点击变化） */
function flyToCard3View() {
  if (!viewer) return
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.5, 39.75, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

/** 创建一个多边形（Entity 方式） */
function addEntityPolygon() {
  if (!viewer) return
  const entity = viewer.entities.add({
    polygon: {
      hierarchy: Cartesian3.fromDegreesArray([
        116.0, 39.0,
        117.0, 39.0,
        117.5, 40.0,
        116.5, 40.5,
        115.8, 40.0,
      ]),
      material: Color.ORANGE.withAlpha(0.5),
      outline: true,
      outlineColor: Color.WHITE,
    },
  })
  card3Entities.push(entity)
  flyToCard3View()
}

/** 创建一个多边形（Primitive 方式） */
function addPrimitivePolygon() {
  if (!viewer) return
  const geometry = PolygonGeometry.fromPositions({
    positions: Cartesian3.fromDegreesArray([
      116.0, 39.0,
      117.0, 39.0,
      117.5, 40.0,
      116.5, 40.5,
      115.8, 40.0,
    ]),
    vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
  })
  const appearance = new PerInstanceColorAppearance({ translucent: true })
  const p = createPrimitive(geometry, appearance, Color.BLUE.withAlpha(0.5))
  card3Primitives.push(p)
  flyToCard3View()
}

/** 批量 Entity ×100 */
function batchEntity() {
  if (!viewer) return
  // 先清除之前批量的
  card3EntityBatch.forEach(e => viewer!.entities.remove(e))
  card3EntityBatch = []

  const t0 = performance.now()
  for (let i = 0; i < 1000; i++) {
    const lon = 115 + Math.random() * 3 // 随机经度范围 115~118
    const lat = 38 + Math.random() * 3 // 随机纬度范围 38~41
    const entity = viewer.entities.add({
      position: Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: 8,
        color: Color.RED.withAlpha(0.6),
      },
    })
    // card3EntityBatch — 只跟踪上一次 batchEntity() 创建的 entity。
    card3EntityBatch.push(entity)
  }
  // Entity 也加到 card3Entities 中以便整体清除
  card3Entities.push(...card3EntityBatch)
  flyToCard3View()
  const t1 = performance.now()
  const ms = +(t1 - t0).toFixed(2)

// 如果性能结果存在
  if (perfResult.value) {
  // 更新性能结果，保留原有属性，并添加或更新entityMs属性
    perfResult.value = { ...perfResult.value, entityMs: ms }
  } else {
  // 如果性能结果不存在，则创建一个新的性能结果对象
  // 包含entityMs属性和primitiveMs属性（primitiveMs初始化为0）
    perfResult.value = { entityMs: ms, primitiveMs: 0 }
  }
  ElMessage.info(`批量 Entity ×1000 耗时: ${ms} ms`)
}

/** 批量 Primitive ×100 */
function batchPrimitive() {
  if (!viewer) return
  // 清除上一批批量创建的 primitive
  card3PrimitiveBatch.forEach(p => viewer!.scene.primitives.remove(p))
  card3PrimitiveBatch = []

  const t0 = performance.now()
  const instances: GeometryInstance[] = []
  for (let i = 0; i < 1000; i++) {
    const lon = 115 + Math.random() * 3
    const lat = 38 + Math.random() * 3
    // 用小的矩形几何体模拟点
    const half = 0.03 // 约 3km
    const geometry = new RectangleGeometry({
      rectangle: Rectangle.fromDegrees(lon - half, lat - half, lon + half, lat + half),
      vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT,
    })
    instances.push(new GeometryInstance({
      geometry,
      attributes: {
        color: ColorGeometryInstanceAttribute.fromColor(Color.RED.withAlpha(0.6)),
      },
    }))
  }
  const appearance = new PerInstanceColorAppearance({ translucent: true })
  const primitive = new Primitive({ geometryInstances: instances, appearance })
  viewer.scene.primitives.add(primitive)
  card3Primitives.push(primitive)
  card3PrimitiveBatch.push(primitive)
  flyToCard3View()
  const t1 = performance.now()
  const ms = +(t1 - t0).toFixed(2)

  if (perfResult.value) {
    perfResult.value = { ...perfResult.value, primitiveMs: ms }
  } else {
    perfResult.value = { entityMs: 0, primitiveMs: ms }
  }
  ElMessage.info(`批量 Primitive ×1000 耗时: ${ms} ms`)
}

function clearCard3() {
  if (!viewer) return
  card3Entities.forEach(e => viewer!.entities.remove(e))
  card3Entities.length = 0
  card3EntityBatch = []
  card3Primitives.forEach(p => viewer!.scene.primitives.remove(p))
  card3Primitives.length = 0
  card3PrimitiveBatch = []
  perfResult.value = null
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
    destination: Cartesian3.fromDegrees(116.39, 39.91, 10000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
  })
})

onUnmounted(() => {
  if (viewer) {
    // 清理所有跟踪的 primitives 和 entities
    card3Entities.forEach(e => viewer!.entities.remove(e))
    // 前面加上分号是为了防止 JavaScript 的自动分号插入机制（ASI）在某些情况下导致语法错误。
    // 因为 [ 可以接在表达式后面做计算属性访问，JS 就不会自动在换行处加分号，
    // 结果把数组字面量当成上一行的后续操作。
    ;[...card1Primitives, ...card2Primitives, ...card3Primitives].forEach(
      p => viewer!.scene.primitives.remove(p),
    )
    card1Primitives.length = 0
    card2Primitives.length = 0
    card3Primitives.length = 0
    card3Entities.length = 0
    card3EntityBatch = []
    card3PrimitiveBatch = []
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

.perf-result {
  margin-top: 8px;
  padding: 8px 10px;
  background: var(--el-color-info-light-9);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.8;
}

.perf-speedup {
  color: var(--el-color-success);
  font-weight: 600;
  margin-top: 2px;
}
</style>
