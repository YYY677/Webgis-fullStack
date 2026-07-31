<template>
  <div class="map-container">
    <div id="cesiumAnnotationEdit" class="cesium-canvas" />

    <!-- 与既有 Cesium 课程保持一致：底图是场景基础能力，标绘数据仍独立放在 DataSource 中。 -->
    <div v-if="panelOpen" class="panel-overlay" @click="panelOpen = false" />
    <div class="map-controls" @click.stop>
      <CesiumBasemapSwitcher :activate="switchBasemap" :initial="currentId" @toggle="panelOpen = $event" />
    </div>
    <div class="basemap-label">{{ currentLabel || "加载中..." }}</div>

    <aside class="left-panel">
      <el-card shadow="never" class="panel-card">
        <template #header>16 · 前端标绘编辑与 GeoJSON 导出</template>
        <p class="card-desc">本课只维护浏览器内存与 Cesium 对象，不调用后端 API。09 负责绘制和量算，这里继续完成编辑与导出。</p>
        <div class="button-grid">
          <el-button :type="drawMode === 'point' ? 'primary' : 'default'" @click="startDrawing('point')">画点</el-button>
          <el-button :type="drawMode === 'line' ? 'primary' : 'default'" @click="startDrawing('line')">画线</el-button>
          <el-button :type="drawMode === 'polygon' ? 'primary' : 'default'"
            @click="startDrawing('polygon')">画面</el-button>
        </div>
        <p class="status-box">{{ drawHint }}</p>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>选择与编辑</template>
        <template v-if="selectedAnnotation">
          <p class="card-desc"><strong>{{ selectedAnnotation.name }}</strong> · {{ selectedAnnotation.type }} · {{
            selectedAnnotation.coordinates.length }} 个顶点</p>
          <p class="card-desc">白色控制点是可拖拽顶点。拖动时相机会暂时锁定，抬起鼠标后恢复。</p>
          <el-button size="small" type="danger" plain @click="deleteSelected">删除选中要素</el-button>
        </template>
        <p v-else class="empty-hint">点击已有标绘即可选中；示例范围已预置，方便直接练习顶点编辑。</p>
      </el-card>

      <el-card shadow="never" class="panel-card">
        <template #header>客户端数据边界</template>
        <p class="card-desc"><code>{{ annotations.length }}</code> 个标绘保存在当前页面内存。导出为 WGS84 GeoJSON 的二维坐标，不写入未经校验的贴地高度。
        </p>
        <div class="button-row">
          <el-button size="small" type="primary" :disabled="!annotations.length" @click="exportGeoJson">导出
            GeoJSON</el-button>
          <el-button size="small" type="danger" plain :disabled="!annotations.length" @click="clearAll">清空全部</el-button>
        </div>
      </el-card>
    </aside>
  </div>
</template>

<script lang="ts">
/** GeoJSON 规定水平坐标顺序为 [longitude, latitude]，不是地图界面常见的 [lat, lng]。 */
export type Wgs84Coordinate = [longitude: number, latitude: number]
/** 标绘类型：点 / 线 / 面，决定实体渲染方式与导出的 GeoJSON 几何结构。 */
export type AnnotationType = "point" | "line" | "polygon"

/** 标绘业务模型（纯数据，不含 Cesium 对象）：页面数据的唯一来源，Entity 与 GeoJSON 都由它派生。 */
export interface Annotation {
  id: string
  name: string
  type: AnnotationType
  color: string
  coordinates: Wgs84Coordinate[]
}

/**
 * 三种 GeoJSON 几何的可辨识联合类型：type 字段是判别键，判断后 TS 自动收窄坐标类型。
 * 用 type 而非 interface：interface 只能描述"单个对象结构"，表达不了"三者之一"的或语义。
 * 使用时机——联合（A | B）、元组、字面量类型只能用 type；纯粹的单个对象结构两者皆可，惯例用 interface。
 */
export type GeoJsonGeometry =
  | { type: "Point"; coordinates: Wgs84Coordinate }
  | { type: "LineString"; coordinates: Wgs84Coordinate[] }
  | { type: "Polygon"; coordinates: Wgs84Coordinate[][] }

export interface AnnotationFeature {
  type: "Feature"
  id: string
  properties: { name: string; type: AnnotationType; color: string }
  geometry: GeoJsonGeometry
}

export interface AnnotationFeatureCollection {
  type: "FeatureCollection"
  features: AnnotationFeature[]
}

/**
 * GeoJSON 规范要求多边形坐标环首尾闭合（第一个点与最后一个点相同）。
 * 无论原数据是否已闭合，都返回全新的数组，不修改调用方持有的坐标。
 */
function closeRing(coordinates: Wgs84Coordinate[]): Wgs84Coordinate[] {
  if (!coordinates.length) return []
  const first = coordinates[0]
  const last = coordinates[coordinates.length - 1]
  // 若首尾相同，直接返回深拷贝；否则在末尾加上首点闭合。
  return first[0] === last[0] && first[1] === last[1]
    ? coordinates.map(([longitude, latitude]): Wgs84Coordinate => [longitude, latitude])
    : [...coordinates.map(([longitude, latitude]): Wgs84Coordinate => [longitude, latitude]), [first[0], first[1]]]
}

/**
 * 将浏览器内存中的标绘模型转为标准 GeoJSON。贴地标绘不把拾取到的临时高度写出，
 * 因为它并不等于经过业务校验的高程字段，二维坐标更适合后续服务端落库。
 * 坐标顺序遵循 GeoJSON 规定的 [longitude, latitude]；注意三种几何的层级不同：
 * Polygon 的 coordinates 是“环的数组”（外层数组包环，环内才是坐标点），
 * 而 Point / LineString 分别是单点与一维坐标数组。
 */
export function annotationToFeatureCollection(annotations: Annotation[]): AnnotationFeatureCollection {
  return {
    type: "FeatureCollection",
    features: annotations.map((annotation): AnnotationFeature => {
      const geometry: GeoJsonGeometry = annotation.type === "point"
        ? { type: "Point", coordinates: [...annotation.coordinates[0]] as Wgs84Coordinate }
        : annotation.type === "line"
          ? { type: "LineString", coordinates: annotation.coordinates.map(([longitude, latitude]) => [longitude, latitude]) }
          : { type: "Polygon", coordinates: [closeRing(annotation.coordinates)] }

      return {
        type: "Feature",
        id: annotation.id,
        properties: { name: annotation.name, type: annotation.type, color: annotation.color },
        geometry,
      }
    }),
  }
}

/**
  为什么需要它
  Cesium 的事件顺序：一次完整的顶点拖拽是 LEFT_DOWN → MOUSE_MOVE... → LEFT_UP，
  然后 Cesium 还会补发一次 LEFT_CLICK。问题就出在这最后一次点击：

  拖拽结束时（endVertexDrag）设置了 ignorePostDragClick = true，就是为了把拖拽后紧跟的那次
  LEFT_CLICK 挡掉——否则它会被 handleLeftClick 当作普通点击，拾取到光标下的顶点辅助实体，
  把当前选中状态清掉（selectedAnnotationId 变 undefined，白色顶点句柄消失）。

  但拖拽标记不能一直留着，否则之后所有正常地图点选都会失效。所以标记是一次性的：
  只忽略紧随其后的那一次点击，消费完立刻复位。
 */
export function consumePostDragClick(shouldIgnore: boolean) {
  return {
    shouldHandle: !shouldIgnore,
    nextShouldIgnore: false,
  }
}

export function translateAnnotationCoordinates(
  coordinates: Wgs84Coordinate[],
  [deltaLongitude, deltaLatitude]: Wgs84Coordinate,
): Wgs84Coordinate[] {
  return coordinates.map(([longitude, latitude]) => [
    Number((longitude + deltaLongitude).toFixed(12)),
    Number((latitude + deltaLatitude).toFixed(12)),
  ])
}
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { ElMessage } from "element-plus"
import {
  CallbackProperty,
  CallbackPositionProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  CustomDataSource,
  defined,
  Entity,
  HeightReference,
  LabelStyle,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import { CESIUM_BASEMAP_LIST } from "@/utils/cesium-basemaps"
import type { CesiumBasemapItem } from "@/utils/cesium-basemaps"

type DrawMode = "none" | AnnotationType
type VertexDrag = { kind: "vertex"; annotationId: string; vertexIndex: number }
type FeatureDrag = {
  kind: "feature"
  annotationId: string
  startCoordinate: Wgs84Coordinate
  originalCoordinates: Wgs84Coordinate[]
}
// DragState 代表当前鼠标拖拽的状态：要么是拖单个顶点，要么是整体平移标绘。
type DragState = VertexDrag | FeatureDrag

// —— 响应式状态：驱动 Vue 面板与提示 ——
// 内存标绘模型数组，页面数据的唯一来源（Cesium DataSource 与它双写同步）
const annotations = ref<Annotation[]>([])
// 当前选中标绘 id，控制“选择与编辑”面板的显示内容
const selectedAnnotationId = ref<string>()
// 当前绘制工具："none" | point | line | polygon
const drawMode = ref<DrawMode>("none")
// 非绘制状态下的提示文案
const statusText = ref("选择工具后，在场景中开始标绘。")
const panelOpen = ref(false)
const currentId = ref("")
const currentLabel = ref("") 

// —— 非响应式状态：Cesium 对象与页面临时状态，不参与 Vue 模板渲染 ——
let viewer: Viewer | null = null 
let pageActive = false
let handler: ScreenSpaceEventHandler | null = null
// 标绘实体容器；与 vertexSource 分离，卸载时按来源清理
let annotationSource: CustomDataSource | null = null
// 顶点句柄容器（白点）
let vertexSource: CustomDataSource | null = null
// 绘制中的预览图形（线/面，随鼠标实时更新）
let previewEntity: Entity | null = null
// 绘制中收集的顶点；双击/右键完成时转入 annotation 并清空
let pendingCoordinates: Wgs84Coordinate[] = []
// 鼠标当前经纬度，仅驱动预览图形
let cursorCoordinate: Wgs84Coordinate | undefined
// 进行中的拖拽：顶点拖拽（改单点）或整体平移（改全部顶点）
let dragState: DragState | null = null
// Cesium 在 LEFT_UP 后会补发一次 LEFT_CLICK，拖拽结束后只忽略这一次。
let ignorePostDragClick = false
// 自增序号，保证标绘名称与 Entity id 唯一
let nextAnnotationId = 0

// 标绘 id → 对应 Entity，选中/删除时按 id 精准定位，
// 相当于一个“Entity 内存索引表”，找到后直接 annotationSource remove。
const annotationEntities = new Map<string, Entity>()
// 当前选中标绘的完整模型
const selectedAnnotation = computed(() => annotations.value.find((item) => item.id === selectedAnnotationId.value))

const drawHint = computed(() => {
  if (drawMode.value === "point") return "左键放置一个点。"
  if (drawMode.value === "line") return "左键依次加点，右键或双击完成折线。"
  if (drawMode.value === "polygon") return "左键依次加点，右键或双击完成多边形。"
  return statusText.value
})

function requestSceneRender() {
  // 编辑事件来自 Cesium，但导出、删除等操作来自 Vue 面板；统一主动请求绘制，
  // 以后即使页面切换为 requestRenderMode，也不会出现“状态更新了但画面没更新”。
  viewer?.scene.requestRender()
}

/**
 * 底图项只操作 imageryLayers；本课标绘和顶点句柄位于两个 CustomDataSource，
 * 因而切换底图不会丢失浏览器内存中的标绘对象或编辑状态。
 */
async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer || item.id === currentId.value) return
  try {
    await item.activate(viewer)
    if (!pageActive || !viewer || viewer.isDestroyed()) return
    currentId.value = item.id
    currentLabel.value = item.label
    requestSceneRender()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    ElMessage.error(`底图切换失败：${message}`)
  }
}

function toCartesian([longitude, latitude]: Wgs84Coordinate) {
  return Cartesian3.fromDegrees(longitude, latitude)
}

function toCartesianArray(coordinates: Wgs84Coordinate[]) {
  return coordinates.map(toCartesian)
}

function toWgs84(position: Cartesian3): Wgs84Coordinate {
  const cartographic = Cartographic.fromCartesian(position)
  return [CesiumMath.toDegrees(cartographic.longitude), CesiumMath.toDegrees(cartographic.latitude)]
}

/**
 * 优先从深度缓冲区取坐标，因此点击 3D Tiles / 模型时能命中可见表面；
 * 没有深度时依次退回地形与椭球，保证纯底图场景也能继续标绘。
 */
function pickWorldPosition(windowPosition: Cartesian2) {
  if (!viewer) return undefined
  const scene = viewer.scene
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(windowPosition)
    if (defined(picked)) return picked
  }
  const ray = viewer.camera.getPickRay(windowPosition)
  if (defined(ray)) {
    const terrainPosition = scene.globe.pick(ray, scene)
    if (defined(terrainPosition)) return terrainPosition
  }
  return viewer.camera.pickEllipsoid(windowPosition, scene.globe.ellipsoid)
}

function annotationById(id: string) {
  return annotations.value.find((item) => item.id === id)
}

function entityForAnnotation(annotation: Annotation) {
  const common = { id: `annotation:${annotation.id}`, name: annotation.name }
  if (annotation.type === "point") {
    return new Entity({
      ...common,
      position: new CallbackPositionProperty(
        () => annotation.coordinates[0] ? toCartesian(annotation.coordinates[0]) : undefined,
        false,
      ),
      point: {
        pixelSize: 12,
        color: Color.fromCssColorString(annotation.color),
        outlineColor: Color.WHITE,
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: annotation.name,
        font: "13px sans-serif",
        fillColor: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cartesian2(0, -25),
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    })
  }

  if (annotation.type === "line") {
    return new Entity({
      ...common,
      polyline: {
        // CallbackProperty 让顶点拖动只改内存模型；Cesium 在下一次绘制时读取最新地址，
        // 不需要每次鼠标移动都删除再创建一条线。
        positions: new CallbackProperty(() => toCartesianArray(annotation.coordinates), false),
        width: 4,
        material: Color.fromCssColorString(annotation.color),
        clampToGround: true,
      },
    })
  }

  return new Entity({
    ...common,
    polygon: {
      hierarchy: new CallbackProperty(() => new PolygonHierarchy(toCartesianArray(annotation.coordinates)), false),
      material: Color.fromCssColorString(annotation.color).withAlpha(0.28),
      outline: true,
      outlineColor: Color.fromCssColorString(annotation.color),
      heightReference: HeightReference.CLAMP_TO_GROUND,
    },
  })
}

function addAnnotationEntity(annotation: Annotation) {
  if (!annotationSource) return
  const entity = annotationSource.entities.add(entityForAnnotation(annotation))
  annotationEntities.set(annotation.id, entity)
}

function clearVertices() {
  vertexSource?.entities.removeAll()
}

function showSelectedVertices() {
  clearVertices()
  const annotation = selectedAnnotation.value
  if (!annotation || !vertexSource) return

  annotation.coordinates.forEach((coordinate, vertexIndex) => {
    vertexSource?.entities.add({
      id: `vertex:${annotation.id}:${vertexIndex}`,
      position: toCartesian(coordinate),
      point: {
        pixelSize: 10,
        color: Color.WHITE,
        outlineColor: Color.fromCssColorString("#1677ff"),
        outlineWidth: 3,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
  })
  requestSceneRender()
}

function resetPendingDrawing() {
  pendingCoordinates = []
  cursorCoordinate = undefined
  if (viewer && previewEntity) viewer.entities.remove(previewEntity)
  previewEntity = null
}

function startDrawing(mode: AnnotationType) {
  resetPendingDrawing()
  // ignorePostDragClick = true 只在拖拽顶点后使用，避免紧随其后的 LEFT_CLICK 误清选中状态。
  ignorePostDragClick = false
  selectedAnnotationId.value = undefined
  clearVertices()
  drawMode.value = mode
  statusText.value = ""
}

function createPreview() {
  if (!viewer || previewEntity || drawMode.value === "none" || drawMode.value === "point") return
  const previewCoordinates = () => cursorCoordinate ? [...pendingCoordinates, cursorCoordinate] : pendingCoordinates
  const previewColor = Color.fromCssColorString("#1677ff")

  previewEntity = drawMode.value === "line"
    ? viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(() => toCartesianArray(previewCoordinates()), false),
        width: 3,
        material: previewColor.withAlpha(0.8),
        clampToGround: true,
      },
    })
    : viewer.entities.add({
      polygon: {
        hierarchy: new CallbackProperty(() => new PolygonHierarchy(toCartesianArray(previewCoordinates())), false),
        material: previewColor.withAlpha(0.18),
        outline: true,
        outlineColor: previewColor,
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
    })
}

function createAnnotation(type: AnnotationType, coordinates: Wgs84Coordinate[]) {
  const annotation: Annotation = {
    id: `annotation-${++nextAnnotationId}`,
    name: `${type === "point" ? "点位" : type === "line" ? "折线" : "范围"} ${nextAnnotationId}`,
    type,
    color: type === "point" ? "#f5222d" : type === "line" ? "#faad14" : "#1677ff",
    // 深拷贝，避免后续拖拽修改内存模型时影响已创建的标绘对象。
    coordinates: coordinates.map(([longitude, latitude]) => [longitude, latitude]),
  }
  annotations.value = [...annotations.value, annotation]
  addAnnotationEntity(annotation)
  selectedAnnotationId.value = annotation.id
  showSelectedVertices()
}

function finishDrawing() {
  if (drawMode.value === "none") return
  const mode = drawMode.value
  const minimumVertices = mode === "point" ? 1 : mode === "line" ? 2 : 3
  if (pendingCoordinates.length < minimumVertices) {
    statusText.value = `${mode === "line" ? "折线" : "多边形"}的顶点数量还不够。`
    return
  }
  createAnnotation(mode, pendingCoordinates)
  resetPendingDrawing()
  drawMode.value = "none"
  statusText.value = "标绘已完成；点击要素可显示并拖拽顶点。"
}

function pickAnnotationId(windowPosition: Cartesian2) {
  if (!viewer) return undefined
  const picked = viewer.scene.pick(windowPosition)
  if (!defined(picked) || !(picked.id instanceof Entity)) return undefined
  return [...annotationEntities.entries()].find(([, entity]) => entity === picked.id)?.[0]
}

/**
 * 从屏幕坐标拾取顶点句柄。顶点 Entity 的 id 按 `vertex:<标绘id>:<索引>` 约定命名，
 * 命中后解析 id 还原业务数据，供 beginVertexDrag 构造拖拽状态，无需额外维护拾取映射表。
 */
function pickVertex(windowPosition: Cartesian2): VertexDrag | undefined {
  if (!viewer) return undefined
  // pick 可能命中普通标绘、Primitive 或非 Entity 对象，先做类型过滤，保证正则只对合法输入执行。
  const picked = viewer.scene.pick(windowPosition)
  if (!defined(picked) || !(picked.id instanceof Entity) || typeof picked.id.id !== "string") return undefined
  // 只认 id 符合 vertex 约定的 Entity，正则同时提取标绘 id 与顶点下标。
  const matched = /^vertex:(.+):(\d+)$/.exec(picked.id.id)
  return matched ? { kind: "vertex", annotationId: matched[1], vertexIndex: Number(matched[2]) } : undefined
}

function handleLeftClick(event: { position: Cartesian2 }) {
  // ① 读取当前标记，决定本次点击要不要处理
  const clickState = consumePostDragClick(ignorePostDragClick) 
  // ② 消费后重置标记（永远变回 false）
  ignorePostDragClick = clickState.nextShouldIgnore
  // ③ 不该处理就直接 return
  if (!clickState.shouldHandle) return

  const position = pickWorldPosition(event.position)
  if (!position) return

  if (drawMode.value !== "none") {
    pendingCoordinates.push(toWgs84(position))
    if (drawMode.value === "point") finishDrawing()
    else createPreview()
    requestSceneRender()
    return
  }

  selectedAnnotationId.value = pickAnnotationId(event.position)
  showSelectedVertices()
}

function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (dragState) {
    const position = pickWorldPosition(event.endPosition)
    const annotation = annotationById(dragState.annotationId)
    if (!position || !annotation) return

    if (dragState.kind === "vertex") {
      annotation.coordinates[dragState.vertexIndex] = toWgs84(position)
    } else {
      const currentCoordinate = toWgs84(position)
      const delta: Wgs84Coordinate = [
        currentCoordinate[0] - dragState.startCoordinate[0],
        currentCoordinate[1] - dragState.startCoordinate[1],
      ]
      annotation.coordinates = translateAnnotationCoordinates(dragState.originalCoordinates, delta)
    }

    showSelectedVertices()
    requestSceneRender()
    return
  }
  if (drawMode.value === "none" || drawMode.value === "point" || !pendingCoordinates.length) return
  const position = pickWorldPosition(event.endPosition)
  cursorCoordinate = position ? toWgs84(position) : undefined
  requestSceneRender()
}

function finishFromPointer(event: { position: Cartesian2 }) {
  if (drawMode.value === "none" || drawMode.value === "point") return
  const position = pickWorldPosition(event.position)
  if (position) {
    const coordinate = toWgs84(position)
    const last = pendingCoordinates[pendingCoordinates.length - 1]
    // 双击通常会先触发一次 LEFT_CLICK；相同末点不再重复压入，避免生成零长度边。
    if (!last || Math.abs(last[0] - coordinate[0]) > 1e-9 || Math.abs(last[1] - coordinate[1]) > 1e-9) {
      pendingCoordinates.push(coordinate)
    }
  }
  finishDrawing()
}

function beginVertexDrag(event: { position: Cartesian2 }) {
  // 只有在非绘制状态下，才允许拖动顶点或整要素。
  if (drawMode.value !== "none" || !viewer) return
  const vertex = pickVertex(event.position)
  /*
  if (vertex)：按下的位置命中了白色顶点句柄 → 拖单个顶点。dragState = 
  { kind: "vertex", annotationId, vertexIndex }，之后的 handleMouseMove 
  只改 annotation.coordinates[vertexIndex] 这一个点，折线/面的形状被拉伸。

  else：没命中句柄 → 再拾取标绘本体（折线/面的线条内部），进入整体平移分支。
  */
  if (vertex) {
    dragState = vertex
  } else {
    const annotationId = pickAnnotationId(event.position)
    const annotation = annotationId ? annotationById(annotationId) : undefined
    const startPosition = pickWorldPosition(event.position)
    // !annotation	按在了空白处或非标绘对象上（比如底图），不进入拖拽
    // annotation.type === "point"	点要素禁止整体拖动——点只有一个顶点，拖它的本体
    // 和拖顶点是同一件事，设计上只留顶点拖动一条路径，避免交互歧义
    // !startPosition	pickWorldPosition 没取到世界坐标（比如按到了天空/相机外），无法算位移
    if (!annotation || annotation.type === "point" || !startPosition) return

    selectedAnnotationId.value = annotation.id
    showSelectedVertices()
    dragState = {
      kind: "feature",
      annotationId: annotation.id,
      startCoordinate: toWgs84(startPosition),
      originalCoordinates: annotation.coordinates.map(([longitude, latitude]) => [longitude, latitude]),
    }
  }
  // 顶点拖动和相机平移都使用鼠标左键。编辑期间临时关闭相机输入，抬键后恢复，
  // 才不会出现“顶点在动、镜头也跟着跑”的常见交互冲突。
  viewer.scene.screenSpaceCameraController.enableInputs = false
}

function endVertexDrag() {
  if (!viewer || !dragState) return

  // 保留当前标绘的选中状态，避免紧随 LEFT_UP 的 LEFT_CLICK 误选中顶点辅助实体。
  ignorePostDragClick = true
  dragState = null
  viewer.scene.screenSpaceCameraController.enableInputs = true
  requestSceneRender()
}

function deleteSelected() {
  const annotation = selectedAnnotation.value
  if (!annotation || !annotationSource) return
  const entity = annotationEntities.get(annotation.id)
  if (entity) annotationSource.entities.remove(entity)
  annotationEntities.delete(annotation.id)
  annotations.value = annotations.value.filter((item) => item.id !== annotation.id)
  selectedAnnotationId.value = undefined
  clearVertices()
  statusText.value = "已从前端内存和 Cesium DataSource 删除选中标绘。"
  requestSceneRender()
}

function clearAll() {
  resetPendingDrawing()
  annotationSource?.entities.removeAll()
  annotationEntities.clear()
  annotations.value = []
  selectedAnnotationId.value = undefined
  drawMode.value = "none"
  clearVertices()
  statusText.value = "已清空当前浏览器会话中的全部标绘。"
  requestSceneRender()
}

/**
 * 整条链路
 * 导出按钮 → annotations(ref) → annotationToFeatureCollection → FeatureCollection(纯数据)
          → JSON.stringify(美化) → Blob(geo+json) → ObjectURL → <a>.click() → 浏览器下载
 */
function exportGeoJson() {
  const featureCollection = annotationToFeatureCollection(annotations.value)
  // JSON.stringify 中第三个参数 2 是缩进美化，导出的文件人类可读；第二个参数 null 是不用替换器。
  const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: "application/geo+json" })
  const url = URL.createObjectURL(blob) // 内存里的 blob 临时地址（blob:...）
  const anchor = document.createElement("a") // 造一个隐形下载链接
  anchor.href = url
  anchor.download = "cesium-annotations.geojson"
  // 链接必须挂进 DOM，部分浏览器（如 Firefox）不挂入 body 会拒绝模拟点击。
  document.body.append(anchor)
  anchor.click() // 模拟点击 → 浏览器开始下载
  anchor.remove() // 卸下链接
  // 让浏览器先读取下载地址再释放，避免部分浏览器中生成空文件。
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function addInitialAnnotation(annotation: Annotation) {
  annotations.value = [...annotations.value, annotation]
  addAnnotationEntity(annotation)
  nextAnnotationId += 1
}

onMounted(() => {
  pageActive = true
  viewer = new Viewer("cesiumAnnotationEdit", {
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
  // 与 01 页及其后的示例统一使用真实瓦片底图；局部放大时仍能看到地图细节。
  const defaultBasemap = CESIUM_BASEMAP_LIST.find((item) => item.id === "mars3d")!
  void switchBasemap(defaultBasemap)
  viewer.camera.setView({ destination: Cartesian3.fromDegrees(116.39, 39.905, 16_000) })

  annotationSource = new CustomDataSource("frontend-annotations")
  vertexSource = new CustomDataSource("annotation-vertices")
  viewer.dataSources.add(annotationSource)
  viewer.dataSources.add(vertexSource)

  addInitialAnnotation({
    id: "annotation-1",
    name: "初始示例面",
    type: "polygon",
    color: "#1677ff",
    coordinates: [[116.382, 39.9], [116.39, 39.912], [116.401, 39.906]],
  })

  // 使用独立 handler，避免把教程交互与 Viewer 默认双击飞行等行为混在一起。
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK)
  handler.setInputAction(finishFromPointer, ScreenSpaceEventType.RIGHT_CLICK)
  handler.setInputAction(finishFromPointer, ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE)
  handler.setInputAction(beginVertexDrag, ScreenSpaceEventType.LEFT_DOWN)
  handler.setInputAction(endVertexDrag, ScreenSpaceEventType.LEFT_UP)
})

onUnmounted(() => {
  pageActive = false
  if (handler && !handler.isDestroyed()) handler.destroy()
  handler = null
  // 页面对象都放在两个 CustomDataSource 内，卸载时按来源移除，避免误伤别的业务图层。
  if (viewer && annotationSource) viewer.dataSources.remove(annotationSource, true)
  if (viewer && vertexSource) viewer.dataSources.remove(vertexSource, true)
  if (viewer && !viewer.isDestroyed()) viewer.destroy()
  viewer = null
  annotationSource = null
  vertexSource = null
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

.panel-overlay {
  position: absolute;
  inset: 0;
  z-index: 99;
}

.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 100;
}

.basemap-label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  z-index: 100;
  padding: 3px 10px;
  color: var(--el-color-white);
  font-size: 12px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  pointer-events: none;
}

.left-panel {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  width: min(380px, calc(100% - 24px));
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

.card-desc {
  margin: 0 0 10px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
}

.button-grid .el-button,
.button-row .el-button {
  margin: 0;
}

.status-box {
  min-height: 36px;
  margin: 10px 0 0;
  padding: 7px 9px;
  color: var(--el-color-primary);
  font-size: 12px;
  line-height: 1.55;
  background: var(--el-color-primary-light-9);
  border-radius: 5px;
}

.empty-hint {
  margin: 0;
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  line-height: 1.65;
}

.button-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .left-panel {
    width: calc(100% - 24px);
    max-height: 56%;
  }
}
</style>
