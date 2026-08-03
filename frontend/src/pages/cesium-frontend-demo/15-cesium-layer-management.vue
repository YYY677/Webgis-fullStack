<template>
  <div class="map-container">
    <div id="cesiumLayerManagement" class="cesium-canvas" />

    <aside class="left-panel">
      <el-card shadow="never" class="panel-card">
        <template #header>15 · 图层体系与图层树管理</template>
        <p class="card-desc">
          图层树是前端业务模型，不是 Cesium 内置对象。叶节点分别适配影像、数据源和
          <code>scene.primitives</code>，所以同一个“显隐”操作会落到不同 API。
        </p>
        <el-tree :data="layerTree" node-key="id" default-expand-all :expand-on-click-node="false"
          @node-click="selectLayer">
          <template #default="{ data }: { data: LayerNode }">
            <div class="tree-node" :class="{ selected: data.id === selectedLayerId }">
              <span class="tree-node__label">{{ data.label }}</span>
              <template v-if="!data.children">
                <el-tag size="small" effect="plain">{{ data.kind }}</el-tag>
                <el-switch :model-value="data.visible" size="small" :disabled="isRemoved(data.id)" @click.stop
                  @update:model-value="syncVisibility(data.id, $event)" />
              </template>
            </div>
          </template>
        </el-tree>
      </el-card>

      <el-card v-if="selectedLayer" shadow="never" class="panel-card">
        <template #header>当前节点：{{ selectedLayer.label }}</template>
        <p class="card-desc">
          <template v-if="selectedLayer.children">分组节点只用于组织 UI，没有可直接操作的 Cesium 对象。</template>
          <template v-else-if="selectedRemoved">该演示对象已从对应 Cesium 集合移除，可重新添加。</template>
          <template v-else>对象类型：<code>{{ selectedLayer.kind }}</code></template>
        </p>

        <template v-if="!selectedLayer.children && !selectedRemoved">
          <div v-if="selectedLayer.kind === 'imagery'" class="control-row">
            <span>透明度</span>
            <el-slider :model-value="imageryAlpha" :min="0" :max="1" :step="0.05"
              @update:model-value="changeImageryAlpha" />
          </div>
          <div v-if="selectedLayer.kind === 'imagery'" class="button-row">
            <el-button size="small" @click="moveSelectedImagery('up')">上移</el-button>
            <el-button size="small" @click="moveSelectedImagery('down')">下移</el-button>
          </div>
          <div class="button-row">
            <el-button v-if="selectedHandle?.flyTo" size="small" type="primary" plain
              @click="flyToSelected">定位</el-button>
            <el-button size="small" type="danger" plain @click="removeSelected">从集合移除</el-button>
          </div>
        </template>
        <el-button v-else-if="!selectedLayer.children" size="small" type="primary" @click="restoreSelected">
          {{ loadingTiles && selectedLayer.id === 'building-tiles' ? '加载中…' : '重新添加' }}
        </el-button>
      </el-card>

      <el-card shadow="never" class="panel-card note-card">
        <template #header>集合速查</template>
        <p><code>viewer.imageryLayers</code>：影像图层，可调顺序和透明度。</p>
        <p><code>viewer.dataSources</code>：GeoJSON、CZML、业务 Entity 分组。</p>
        <p><code>scene.primitives</code>：3D Tiles 等低层场景对象。</p>
      </el-card>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * Cesium 没有统一的“图层树”对象：影像、DataSource、Entity 和 3D Tiles
 * 分别位于不同集合。本课先定义前端业务树，再在页面内把叶节点适配到 Cesium 对象。
 */
export type LayerKind = "group" | "imagery" | "dataSource" | "entitySource" | "tileset"

/**
 * 15 页故意不调用通用底图切换器：它的 activate() 会清空整个 imageryLayers，
 * 从而把本课同样需要管理的经纬网参考层一起删除。这里把 Mars3D 底图本身
 * 当成图层树中的一个叶节点，才能完整演示影像层的显隐、透明度、顺序与重建。
 */
export const MARS3D_IMAGE_LAYER_OPTIONS = {
  url: "//data.mars3d.cn/tile/img/{z}/{x}/{y}.jpg",
  maximumLevel: 18,
}

export interface LayerNode {
  id: string
  label: string
  kind: LayerKind
  visible: boolean
  children?: LayerNode[]
}

export function createDemoLayerTree(): LayerNode[] {
  return [
    {
      id: "basemap",
      label: "底图与参考",
      kind: "group",
      visible: true,
      children: [
        { id: "base-imagery", label: "Mars3D 影像底图", kind: "imagery", visible: true },
        { id: "grid-imagery", label: "经纬网参考层", kind: "imagery", visible: true },
      ],
    },
    {
      id: "business",
      label: "业务数据源",
      kind: "group",
      visible: true,
      children: [
        { id: "district-data", label: "示例业务范围（GeoJSON）", kind: "dataSource", visible: true },
        { id: "business-markers", label: "业务标记（CustomDataSource）", kind: "entitySource", visible: true },
      ],
    },
    {
      id: "scene-data",
      label: "三维场景数据",
      kind: "group",
      visible: true,
      children: [
        { id: "building-tiles", label: "建筑白模（3D Tiles）", kind: "tileset", visible: true },
      ],
    },
  ]
}

export function findLayer(nodes: LayerNode[], id: string): LayerNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    const child = node.children ? findLayer(node.children, id) : undefined
    if (child) return child
  }
  return undefined
}

/** 只有叶节点才对应一个可操作的 Cesium 对象，分组节点只服务于前端 UI。 */
export function getOperableLayerIds(nodes: LayerNode[]): string[] {
  return nodes.flatMap((node) => node.children ? getOperableLayerIds(node.children) : [node.id])
}

/**
 * 不可变地更新图层树中叶节点的 visible 属性。
 *
 *   nodes.map(...)
 *     遍历整个数组，返回新数组 —— 原数组不被修改，Vue 能通过引用变化感知到更新。
 *
 *   ...node
 *     浅拷贝当前节点。如果不展开直接改 visible，原对象会被修改，Vue 嵌套响应式
 *     追踪不到深层变化，el-tree 不会重新渲染。
 *
 *   !node.children && node.id === id ? visible : node.visible
 *     只有叶节点（!node.children）才更新 visible；分组节点只用于 UI 组织，没有
 *     对应的 Cesium 对象，即使 id 匹配也不改它的 visible，防止误改。
 *     匹配到目标 id 时用传入的新值，否则保留原值。
 *
 *   children: node.children ? setVisibility(...) : undefined
 *     如果有子节点就递归深入，继续按 id 查找并更新；叶节点没有 children
 *     则设为 undefined，保持输出结构一致。
 */
export function setLayerVisibility(nodes: LayerNode[], id: string, visible: boolean): LayerNode[] {
  return nodes.map((node) => ({
    ...node,
    visible: !node.children && node.id === id ? visible : node.visible,
    children: node.children ? setLayerVisibility(node.children, id, visible) : undefined,
  }))
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import {
  Cartesian2,
  Cartesian3,
  Cesium3DTileset,
  Color,
  CustomDataSource,
  GeoJsonDataSource,
  GridImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
  type DataSource,
  type ImageryLayer,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import { publicUrl } from "@/utils/public-url"

type ManagedLayerHandle = {
  setVisible: (visible: boolean) => void
  setAlpha?: (alpha: number) => void
  move?: (direction: "up" | "down") => void
  flyTo?: () => void
  remove: () => void
}

const layerTree = ref(createDemoLayerTree())
const selectedLayerId = ref("grid-imagery")
const removedLayerIds = ref<string[]>([])
const imageryAlpha = ref(0.72)
const loadingTiles = ref(false)

let viewer: Viewer | null = null
let pageActive = true
const handles = new Map<string, ManagedLayerHandle>()

const selectedLayer = computed(() => findLayer(layerTree.value, selectedLayerId.value))
const selectedRemoved = computed(() => removedLayerIds.value.includes(selectedLayerId.value))
const selectedHandle = computed(() => handles.get(selectedLayerId.value))

function requestSceneRender() {
  // 显式渲染模式下，这个调用是让“Vue 状态已变”真正反映到画布的桥梁；
  // 当前页默认连续渲染，但这里仍保留这个正确的工程习惯。
  viewer?.scene.requestRender()
}

function isRemoved(id: string) {
  return removedLayerIds.value.includes(id)
}

function selectLayer(node: LayerNode) {
  selectedLayerId.value = node.id
}

function syncVisibility(id: string, visible: boolean) {
  if (!getOperableLayerIds(layerTree.value).includes(id)) return
  layerTree.value = setLayerVisibility(layerTree.value, id, visible)
  handles.get(id)?.setVisible(visible)
  requestSceneRender()
}

function changeImageryAlpha(value: number) {
  imageryAlpha.value = value
  selectedHandle.value?.setAlpha?.(value)
  requestSceneRender()
}

function moveSelectedImagery(direction: "up" | "down") {
  selectedHandle.value?.move?.(direction)
  requestSceneRender()
}

function flyToSelected() {
  selectedHandle.value?.flyTo?.()
}

function removeSelected() {
  const id = selectedLayerId.value
  const handle = handles.get(id)
  if (!handle || isRemoved(id)) return

  handle.remove()
  handles.delete(id)
  removedLayerIds.value = [...removedLayerIds.value, id]
  requestSceneRender()
}

// 从已移除列表清除 — removedLayerIds.value.filter(item => item !== id)
// 让 UI 树状态与图层实际可见性同步 — setLayerVisibility(... node.visible)
function markLayerAdded(id: string) {
  removedLayerIds.value = removedLayerIds.value.filter((item) => item !== id)
  const node = findLayer(layerTree.value, id)
  if (node) layerTree.value = setLayerVisibility(layerTree.value, id, node.visible)
}

function addBaseImagery() {
  if (!viewer || handles.has("base-imagery")) return
  const layer = viewer.imageryLayers.addImageryProvider(new UrlTemplateImageryProvider(
    MARS3D_IMAGE_LAYER_OPTIONS,
  ))
  handles.set("base-imagery", {
    setVisible: (visible) => { layer.show = visible },
    setAlpha: (alpha) => { layer.alpha = alpha },
    move: (direction) => {
      if (!viewer) return
      direction === "up" ? viewer.imageryLayers.raise(layer) : viewer.imageryLayers.lower(layer)
    },
    remove: () => { viewer?.imageryLayers.remove(layer, true) },
  })
  markLayerAdded("base-imagery")
}

function addGridImagery() {
  if (!viewer || handles.has("grid-imagery")) return
  const layer = viewer.imageryLayers.addImageryProvider(new GridImageryProvider({
    color: Color.WHITE.withAlpha(0.55),
    glowColor: Color.BLACK.withAlpha(0.4),
    glowWidth: 3,
  }))
  layer.alpha = imageryAlpha.value
  handles.set("grid-imagery", {
    setVisible: (visible) => { layer.show = visible },
    setAlpha: (alpha) => { layer.alpha = alpha },
    move: (direction) => {
      if (!viewer) return
      direction === "up" ? viewer.imageryLayers.raise(layer) : viewer.imageryLayers.lower(layer)
    },
    remove: () => { viewer?.imageryLayers.remove(layer, true) },
  })
  markLayerAdded("grid-imagery")
}

function addDataSourceHandle(id: string, dataSource: DataSource) {
  if (!viewer) return
  viewer.dataSources.add(dataSource)
  handles.set(id, {
    setVisible: (visible) => { dataSource.show = visible },
    flyTo: () => { void viewer?.flyTo(dataSource) },
    remove: () => { viewer?.dataSources.remove(dataSource, true) },
  })
  markLayerAdded(id)
}

async function addDistrictDataSource() {
  if (!viewer || handles.has("district-data")) return

  const dataSource = await GeoJsonDataSource.load({
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: "前端业务范围" },
      geometry: {
        type: "Polygon",
        coordinates: [[[116.37, 39.895], [116.405, 39.895], [116.405, 39.918], [116.37, 39.918], [116.37, 39.895]]],
      },
    }],
  }, {
    clampToGround: true,
    fill: Color.fromCssColorString("#1677ff").withAlpha(0.6),
    stroke: Color.fromCssColorString("#1677ff"),
    strokeWidth: 3,
  })

  // GeoJsonDataSource.load 是异步操作。路由已经离开时不能再把结果写回已销毁 Viewer。
  if (!pageActive || !viewer || handles.has("district-data")) return
  addDataSourceHandle("district-data", dataSource)
}

function addBusinessMarkerSource() {
  if (!viewer || handles.has("business-markers")) return
  const dataSource = new CustomDataSource("business-markers")
  dataSource.entities.add({
    id: "command-center",
    name: "指挥中心",
    position: Cartesian3.fromDegrees(116.388, 39.906, 70),
    point: {
      pixelSize: 13,
      color: Color.fromCssColorString("#f5222d"),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: "指挥中心",
      font: "14px sans-serif",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 3,
      pixelOffset: new Cartesian2(0, -25),
    },
  })
  dataSource.entities.add({
    id: "inspection-point",
    name: "巡检点",
    position: Cartesian3.fromDegrees(116.397, 39.901, 55),
    point: {
      pixelSize: 11,
      color: Color.fromCssColorString("#faad14"),
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
  })
  addDataSourceHandle("business-markers", dataSource)
}

async function addBuildingTileset() {
  if (!viewer || handles.has("building-tiles") || loadingTiles.value) return
  loadingTiles.value = true
  try {
    const tileset = await Cesium3DTileset.fromUrl(publicUrl("cesium-data/tiles-buildings/tileset.json"), {
      maximumScreenSpaceError: 16,
    })
    if (!pageActive || !viewer || handles.has("building-tiles")) {
      tileset.destroy()
      return
    }
    viewer.scene.primitives.add(tileset)
    handles.set("building-tiles", {
      setVisible: (visible) => { tileset.show = visible },
      flyTo: () => { void viewer?.flyTo(tileset) },
      remove: () => { viewer?.scene.primitives.remove(tileset) },
    })
    markLayerAdded("building-tiles")
  } catch (error) {
    console.error("建筑 3D Tiles 加载失败", error)
  } finally {
    loadingTiles.value = false
  }
}

async function addLayerById(id: string) {
  if (id === "base-imagery") addBaseImagery()
  if (id === "grid-imagery") addGridImagery()
  if (id === "district-data") await addDistrictDataSource()
  if (id === "business-markers") addBusinessMarkerSource()
  if (id === "building-tiles") await addBuildingTileset()
  requestSceneRender()
}

async function restoreSelected() {
  await addLayerById(selectedLayerId.value)
}

onMounted(async () => {
  viewer = new Viewer("cesiumLayerManagement", {
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
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.39, 39.906, 22_000) })

  addBaseImagery()
  addGridImagery()
  await addDistrictDataSource()
  addBusinessMarkerSource()
  void addBuildingTileset()
})

onUnmounted(() => {
  pageActive = false
  // 不调用 removeAll：它会混淆“本课创建的对象”和应用未来可能共存的对象。
  // 这里按句柄只移除本页注册过的图层，才是企业多图层页面可复用的清理方式。
  for (const handle of [...handles.values()].reverse()) handle.remove()
  handles.clear()
  if (viewer && !viewer.isDestroyed()) viewer.destroy()
  viewer = null
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

.card-desc,
.note-card p {
  margin: 0 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.note-card p:last-child,
.card-desc:last-child {
  margin-bottom: 0;
}

.tree-node {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;
  gap: 7px;
  padding: 3px 0;
}

.tree-node__label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.tree-node.selected .tree-node__label {
  color: var(--el-color-primary);
  font-weight: 700;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.control-row .el-slider {
  flex: 1;
}

.button-row {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.button-row .el-button {
  margin: 0;
}

@media (max-width: 640px) {
  .left-panel {
    width: calc(100% - 24px);
    max-height: 56%;
  }
}
</style>
