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

        <!-- ════════════ 卡片一：点状要素 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>📍 点状要素 — Point · Billboard · Label</template>

          <p class="card-desc">
            Point（圆点）、Billboard（图标）、Label（文字标签）三种标注方式，
            同一经纬度展示，直观对比视觉差异。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addPoint">● 添加标记点</el-button>
            <el-button size="small" @click="addBillboard">🖼️ 添加图标</el-button>
            <el-button size="small" @click="addLabel">🔤 添加文字标签</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearEntities(card1Entities)">清除点要素</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片二：线面要素 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>📐 线面要素 — Polyline · Polygon · Rectangle</template>

          <p class="card-desc">
            Entity 声明式定义几何形状：折线用坐标数组，多边形用层级，
            矩形用经纬度范围。每个形状各自独立描述。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addPolyline">📏 添加折线</el-button>
            <el-button size="small" @click="addPolygon">⬡ 添加多边形</el-button>
            <el-button size="small" @click="addRectangle">▭ 添加矩形</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearEntities(card2Entities)">清除线面要素</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片三：三维体 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🧊 三维体 — Box · Cylinder · Ellipsoid</template>

          <p class="card-desc">
            Entity 直接支持 3D 体素：Box（立方体）、Cylinder（圆柱）、
            Ellipsoid（椭球）。添加后自动飞入视角。
          </p>

          <div class="button-row">
            <el-button size="small" @click="addBox">🧊 添加立方体</el-button>
            <el-button size="small" @click="addCylinder">🥫 添加圆柱</el-button>
            <el-button size="small" @click="addEllipsoid">🥚 添加椭球</el-button>
          </div>
          <div class="toolbar-row">
            <el-button size="small" type="danger" plain @click="clearEntities(card3Entities)">清除三维体</el-button>
          </div>
        </el-card>

        <!-- ════════════ 卡片四：属性编辑 ════════════ -->
        <el-card shadow="never" class="panel-card">
          <template #header>🎛️ 运行时属性编辑</template>

          <p class="card-desc">
            选中一个已添加的 Entity，拖动滑块实时修改其属性，
            不需要重建对象。
          </p>

          <div class="button-row">
            <el-button size="small"
              :type="polygonEntity && editingEntity === polygonEntity ? 'primary' : ''"
              @click="selectEntity('polygon')">
              选中多边形
            </el-button>
            <el-button size="small"
              :type="pointEntity && editingEntity === pointEntity ? 'primary' : ''"
              @click="selectEntity('point')">
              选中标记点
            </el-button>
          </div>

          <p v-if="!editingEntity" class="card-desc" style="text-align:center;margin-bottom:0;">
            请先添加多边形或标记点，然后点击上方按钮选中
          </p>

          <div v-if="editingEntity?.polygon" class="slider-row" style="margin-top: 8px;">
            <label>透明度</label>
            <el-slider v-model="editAlpha" :min="0" :max="1" :step="0.05"
              @update:modelValue="updateAlpha" />
            <span class="slider-val">{{ editAlpha.toFixed(2) }}</span>
          </div>

          <div v-if="editingEntity?.point" class="slider-row">
            <label>像素大小</label>
            <el-slider v-model="editSize" :min="2" :max="40" :step="1"
              @update:modelValue="updateSize" />
            <span class="slider-val">{{ editSize }}px</span>
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
  Color,
  Cartesian3,
  ColorMaterialProperty,
  Rectangle,
  ConstantProperty,
  Entity,
  VerticalOrigin,
  LabelStyle,
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

// 属性编辑滑块值（初始值与默认 entity 创建值一致）
const editAlpha = ref(0.4)
const editSize = ref(12)

// ── Cesium 引用 ──
let viewer: Viewer | null = null

// ── Entity 跟踪 ──
/** 卡片一的 entity 列表（point / billboard / label） */
const card1Entities: Entity[] = []
/** 卡片二的 entity 列表（polyline / polygon / rectangle） */
const card2Entities: Entity[] = []
/** 卡片三的 entity 列表（box / cylinder / ellipsoid） */
const card3Entities: Entity[] = []

/** 单独引用 point entity，供卡片四编辑 */
let pointEntity: Entity | null = null
/** 单独引用 polygon entity，供卡片四编辑 */
let polygonEntity: Entity | null = null
/** 当前正在编辑的 entity */
const editingEntity = ref<Entity | null>(null)

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
 * 从 card1Entities / card2Entities / card3Entities 中移除所有 entity。
 * 从 viewer.entities 中删除后，再清空数组。
 */
function clearEntities(list: Entity[]) {
  if (!viewer) return
  list.forEach(e => viewer!.entities.remove(e))
  list.length = 0
  // 检查editingEntity.value是否存在且不在viewer.entities集合中
  if (editingEntity.value && !viewer.entities.contains(editingEntity.value)) {
    editingEntity.value = null
  }
  resetToDefaultView()
}

// ══════════════════════════════════════════
// 卡片一：点状要素
// 其本身没有地理位置信息，所以需要添加position属性定位
// ══════════════════════════════════════════

function addPoint() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.39, 39.91),
    point: { pixelSize: 12, color: Color.RED },
  })
  pointEntity = entity
  card1Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addBillboard() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.39, 39.91),
    // billboard和point的区别是，billboard可以使用图片作为标注，而point只能使用点
    // scale属性可以控制图片的缩放比例，2代表2倍大小，verticalOrigin属性可以控制图片的垂直对齐方式
    billboard: { image: "/icons/icon-1.png", scale: 1, verticalOrigin: VerticalOrigin.BOTTOM },
  })
  card1Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addLabel() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.39, 39.91),
    label: {
      text: "北京\nBeijing",
      font: "18px sans-serif",
      fillColor: Color.YELLOW,
      outlineColor: Color.BLACK,
      outlineWidth: 2,
      // LabelStyle.FILL_AND_OUTLINE 表示文字标签同时具有填充和描边效果
      style: LabelStyle.FILL_AND_OUTLINE,
      // pixelOffset属性可以控制文字标签相对于位置的偏移量，这里设置为向上偏移30像素
      pixelOffset: { x: 0, y: -30 } as any,
    },
  })
  card1Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(116.39, 39.91, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

// ══════════════════════════════════════════
// 卡片二：线面要素
// 其自带地理信息，故不需要positon属性定位。
// ══════════════════════════════════════════

function addPolyline() {
  if (!viewer) return
  const entity = viewer.entities.add({
    polyline: {
      //positions：多个点连线
      positions: Cartesian3.fromDegreesArray([
        116.0, 39.5,
        117.0, 39.5,
        117.5, 40.0,
        116.5, 40.5,
      ]),
      width: 4,
      material: Color.ORANGE,
    },
  })
  card2Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.0, 39.88, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addPolygon() {
  if (!viewer) return
  const entity = viewer.entities.add({
    polygon: {
      // hierarchy：外环+洞，也可以没有洞。
      // 这里使用Cartesian3.fromDegreesArray()方法创建一个多边形的外环坐标数组。
      hierarchy: Cartesian3.fromDegreesArray([
        115.5, 38.0,
        117.5, 38.0,
        118.5, 39.5,
        117.0, 41.0,
        115.0, 40.0,
      ]),
      material: Color.GREEN.withAlpha(0.4),
      // 对于 Polygon（多边形）和 Rectangle（矩形）：浏览器的 WebGL 限制：在大多数现代浏览器中，
      // 多边形和矩形的轮廓线是无法渲染的。即使你设置了 outline: true 和 outlineWidth: 2，它们在画面上也是不可见的。
      // 解决方法：如果需要显示多边形或矩形的边框，必须使用 Polyline（折线）来手动勾勒其边缘。
      outline: true,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
  })
  polygonEntity = entity
  card2Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.0, 39.5, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

function addRectangle() {
  if (!viewer) return
  const entity = viewer.entities.add({
    rectangle: {
      // coordinates：矩形的规则范围
      // Rectangle.fromDegrees(west, south, east, north) 方法用于创建一个矩形对象，
      // 这里创建了一个从经度 114.5°E 到 118.0°E，纬度 37.5°N 到 40.5°N 的矩形。
      coordinates: Rectangle.fromDegrees(114.5, 37.5, 118.0, 40.5),
      material: Color.BLUE.withAlpha(0.25),
      outline: true,
      outlineColor: Color.WHITE,
    },
  })
  card2Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(115.0, 39.0, 1000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-90), roll: 0 },
    duration: 1.0,
  })
}

// ══════════════════════════════════════════
// 卡片三：三维体
// 其本身没有地理位置信息，所以需要添加position属性定位
// ══════════════════════════════════════════

function addBox() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(114.0, 40.5, 300000),
    box: {
      // dimensions属性定义了立方体在x、y、z三个方向上的尺寸。
      dimensions: new Cartesian3(200000, 200000, 200000),
      material: Color.RED.withAlpha(0.7),
      outline: true,
      outlineColor: Color.WHITE,
    },
  })
  card3Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(112.0, 33.5, 2000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-65), roll: 0 },
    duration: 1.0,
  })
}

function addCylinder() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(117.5, 39.5, 200000),
    cylinder: {
      length: 400000,
      // topRadius 和 bottomRadius 属性定义了圆柱体的顶部和底部半径
      topRadius: 80000,
      bottomRadius: 150000,
      material: Color.GREEN.withAlpha(0.6),
      outline: true,
      outlineColor: Color.WHITE,
    },
  })
  card3Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(112.0, 32.5, 2000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-65), roll: 0 },
    duration: 1.0,
  })
}

function addEllipsoid() {
  if (!viewer) return
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(116.0, 36.0, 300000),
    ellipsoid: {
      // radii属性定义了椭球体在x、y、z三个方向上的半径，分别为150000米、200000米和250000米。
      radii: new Cartesian3(150000, 200000, 250000),
      material: Color.BLUE.withAlpha(0.4),
      outline: true,
      outlineColor: Color.WHITE,
    },
  })
  card3Entities.push(entity)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(112.0, 30.5, 2000000),
    orientation: { heading: 0, pitch: CesiumMath.toRadians(-65), roll: 0 },
    duration: 1.0,
  })
}

// ══════════════════════════════════════════
// 卡片四：运行时属性编辑
// ══════════════════════════════════════════

function selectEntity(type: "point" | "polygon") {
  const target = type === "point" ? pointEntity : polygonEntity
  if (!target || !viewer) {
    ElMessage.warning("请先添加对应的 entity")
    return
  }
  editingEntity.value = target
  // 同步滑块值到当前 entity 的属性
  if (target.point) {
    // viewer.clock.currentTime的作用是获取当前的时间点，以便在动态场景中获取材质的实时颜色值。
    // 因为Cesium中的材质属性可能会随时间变化，所以需要使用当前时间来获取准确的颜色值。
    const ps = target.point.pixelSize?.getValue(viewer.clock.currentTime) ?? 12
    editSize.value = typeof ps === "number" ? ps : 12
  }
  if (target.polygon) {
    const mat = target.polygon.material as ColorMaterialProperty
    // viewer.clock.currentTime的作用是获取当前的时间点，以便在动态场景中获取材质的实时颜色值。
    // 因为Cesium中的材质属性可能会随时间变化，所以需要使用当前时间来获取准确的颜色值。
    const color = mat?.color?.getValue(viewer.clock.currentTime) as Color | undefined
    editAlpha.value = +(color?.alpha ?? 1).toFixed(2)
  }
  ElMessage.info(`已选中${type === "point" ? "标记点" : "多边形"}`)
}

function updateAlpha(val: number) {
  if (!editingEntity.value?.polygon || !viewer) return
  const mat = editingEntity.value.polygon.material as ColorMaterialProperty | undefined
  const cur = mat?.color?.getValue(viewer.clock.currentTime) as Color | undefined
  if (cur && mat?.color) {
    (mat.color as ConstantProperty).setValue(new Color(cur.red, cur.green, cur.blue, val))
  }
}

function updateSize(val: number) {
  const entity = editingEntity.value
  if (!entity?.point) return
  (entity.point.pixelSize as ConstantProperty).setValue(val)
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
  // 清理所有 entity 引用
  card1Entities.length = 0
  card2Entities.length = 0
  card3Entities.length = 0
  pointEntity = null
  polygonEntity = null
  editingEntity.value = null
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

/* ── 按钮行 ── */
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
</style>
