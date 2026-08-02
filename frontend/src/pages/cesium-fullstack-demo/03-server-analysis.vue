<template>
  <div class="analysis-workbench">
    <el-tabs
      v-model="activeTab"
      class="analysis-tabs"
      @tab-change="onTabChange"
    >
      <el-tab-pane label="缓冲区" name="buffer" />
      <el-tab-pane label="叠加" name="intersection" />
      <el-tab-pane label="合并" name="union" />
      <el-tab-pane label="差异" name="difference" />
      <el-tab-pane label="对称差" name="symdifference" />
      <el-tab-pane label="空间关系" name="relation" />
      <el-tab-pane label="路径分析" name="path" />
      <el-tab-pane label="测量" name="measure" />
    </el-tabs>

    <div class="analysis-body">
      <aside class="param-panel">
        <template v-if="activeTab === 'buffer'">
          <GeometryInput
            label="输入几何"
            :value="geomInput1"
            @draw="startDraw(1)"
          />
          <div class="param-section">
            <div class="param-label">缓冲区距离</div>
            <el-input-number
              v-model="bufferDistance"
              :min="0"
              :max="100000"
              :step="100"
            />
            <span class="param-unit">米</span>
          </div>
        </template>

        <template v-if="isDualGeomTab">
          <GeometryInput
            label="几何 1"
            :value="geomInput1"
            @draw="startDraw(1)"
          />
          <GeometryInput
            label="几何 2"
            :value="geomInput2"
            @draw="startDraw(2)"
          />
        </template>

        <template v-if="activeTab === 'path'">
          <div class="path-note">
            路网图层来自 GeoServer，选点后由 pgRouting 计算最短路径。
          </div>
          <div class="param-section">
            <div class="param-label">起点</div>
            <el-button
              size="small"
              type="success"
              @click="startPathPick('start')"
            >
              {{ pathPicking === "start" ? "点击地图选点..." : "设置起点" }}
            </el-button>
            <el-tag v-if="pathStart" type="success" class="coord-tag">
              {{ formatCoordinate(pathStart) }}
            </el-tag>
          </div>
          <div class="param-section">
            <div class="param-label">终点</div>
            <el-button
              size="small"
              type="warning"
              @click="startPathPick('end')"
            >
              {{ pathPicking === "end" ? "点击地图选点..." : "设置终点" }}
            </el-button>
            <el-tag v-if="pathEnd" type="warning" class="coord-tag">
              {{ formatCoordinate(pathEnd) }}
            </el-tag>
          </div>
        </template>

        <template v-if="activeTab === 'measure'">
          <div class="param-section">
            <div class="param-label">测量类型</div>
            <el-select v-model="measureType" size="small">
              <el-option label="距离（两个几何之间）" value="distance" />
              <el-option label="面积" value="area" />
              <el-option label="长度" value="length" />
              <el-option label="中心点" value="centroid" />
            </el-select>
          </div>
          <div class="param-section">
            <div class="param-label">绘制类型</div>
            <el-radio-group v-model="measureGeomType" size="small">
              <el-radio-button value="Point">点</el-radio-button>
              <el-radio-button value="LineString">线</el-radio-button>
              <el-radio-button value="Polygon">面</el-radio-button>
            </el-radio-group>
          </div>
          <GeometryInput
            label="几何 1"
            :value="geomInput1"
            @draw="startDraw(1, measureGeomType)"
          />
          <GeometryInput
            v-if="measureType === 'distance'"
            label="几何 2"
            :value="geomInput2"
            @draw="startDraw(2, measureGeomType)"
          />
        </template>

        <div class="param-actions">
          <el-button
            v-if="hasInput"
            size="small"
            @click="clearAllInput"
          >
            清除绘制
          </el-button>
          <el-button
            type="primary"
            :loading="analysisLoading"
            @click="doAnalysis"
          >
            {{ activeTab === "path" ? "导航" : "提交分析" }}
          </el-button>
        </div>

        <section v-if="showResult" class="result-card">
          <h3>分析结果</h3>
          <el-alert
            v-if="activeTab === 'measure' && measureResult"
            :title="String(measureResult)"
            type="success"
            :closable="false"
          />
          <el-alert
            v-if="activeTab === 'relation'"
            :title="relationDescription"
            type="info"
            :closable="false"
          />
          <el-table
            v-if="activeTab === 'relation'"
            :data="relationRows"
            border
            size="small"
          >
            <el-table-column prop="name" label="关系" width="76" />
            <el-table-column label="结果" width="66">
              <template #default="{ row }">
                <el-tag
                  :type="row.value ? 'success' : 'danger'"
                  size="small"
                >
                  {{ row.value ? "是" : "否" }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" />
          </el-table>
          <div v-if="activeTab === 'path'" class="path-result">
            路径总长度：<strong>{{ pathCost.toFixed(2) }}</strong> 米
          </div>
          <el-input
            v-if="showWktResult"
            v-model="resultWkt"
            type="textarea"
            :rows="3"
            readonly
          />
        </section>
      </aside>

      <main class="map-area">
        <div id="cesiumAnalysisMap" class="map-root"></div>
        <div class="map-controls">
          <CesiumBasemapSwitcher
            :activate="switchBasemap"
            :initial="currentBasemapId"
          />
        </div>
        <el-tag v-if="drawHint" class="draw-hint" type="warning">
          {{ drawHint }}
        </el-tag>
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from "vue"
import { ElButton, ElInput } from "element-plus"

const GeometryInput = defineComponent({
  name: "GeometryInput",
  props: {
    label: { type: String, required: true },
    value: { type: String, default: "" },
  },
  emits: ["draw"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "param-section" }, [
        h("div", { class: "param-label" }, props.label),
        h(
          ElButton,
          {
            size: "small",
            onClick: () => emit("draw"),
          },
          () => "在地图上绘制",
        ),
        h(ElInput, {
          modelValue: props.value,
          type: "textarea",
          rows: 3,
          readonly: true,
          placeholder: "请在地图上绘制",
          class: "geom-input",
        }),
      ])
  },
})
</script>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { ElMessage } from "element-plus"
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Color,
  Entity,
  GeoJsonDataSource,
  HeadingPitchRange,
  ImageryLayer,
  Math as CesiumMath,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  WebMapServiceImageryProvider,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import {
  CESIUM_BASEMAP_LIST,
  type CesiumBasemapItem,
} from "@/utils/cesium-basemaps"
import {
  areaAnalysis,
  bufferAnalysis,
  centroidAnalysis,
  differenceAnalysis,
  distanceAnalysis,
  intersectionAnalysis,
  lengthAnalysis,
  relationAnalysis,
  shortestPath,
  symdiffAnalysis,
  unionAnalysis,
} from "@/api/spatial-analysis"
import {
  cartographicToLonLat,
  coordinatesToWkt,
  normalizeGeometryKind,
  wktToGeoJsonFeature,
  type GeometryKind,
  type LonLat,
} from "./cesium-fullstack-geometry"

type GeometrySlot = 1 | 2
type PathPoint = "start" | "end"

const activeTab = ref("buffer")
const geomInput1 = ref("")
const geomInput2 = ref("")
const bufferDistance = ref(500)
const measureType = ref("distance")
const measureGeomType = ref<"Point" | "LineString" | "Polygon">(
  "Polygon",
)
const measureResult = ref<string | number>("")
const resultWkt = ref("")
const resultRelations = ref<Record<string, boolean>>({})
const pathStart = ref<LonLat | null>(null)
const pathEnd = ref<LonLat | null>(null)
const pathCost = ref(0)
const pathPicking = ref<PathPoint | null>(null)
const showResult = ref(false)
const analysisLoading = ref(false)
const currentBasemapId = ref("")
const drawMode = ref<GeometryKind | null>(null)
const drawSlot = ref<GeometrySlot | null>(null)

let viewer: Viewer | undefined
let handler: ScreenSpaceEventHandler | undefined
let resultSource: GeoJsonDataSource | undefined
let roadLayer: ImageryLayer | undefined
let previewEntity: Entity | undefined
let vertexEntities: Entity[] = []
let drawCoordinates: LonLat[] = []
let floatingCoordinate: LonLat | undefined

const inputEntities = new Map<GeometrySlot, Entity>()
const pathEntities = new Map<PathPoint, Entity>()

const ROAD_LAYER = "webgistest:shenzhen_roads"
const WMS_URL = "/geoserver/wms"

const TOP_DOWN_ORIENTATION = {
  heading: 0,
  pitch: -CesiumMath.PI_OVER_TWO,
  roll: 0,
}

const TOP_DOWN_FIT_OFFSET = new HeadingPitchRange(
  0,
  -CesiumMath.PI_OVER_TWO,
  0,
)

const isDualGeomTab = computed(() =>
  [
    "intersection",
    "union",
    "difference",
    "symdifference",
    "relation",
  ].includes(activeTab.value),
)

const hasInput = computed(
  () =>
    Boolean(geomInput1.value || geomInput2.value) ||
    Boolean(pathStart.value || pathEnd.value),
)

const drawHint = computed(() => {
  if (pathPicking.value) {
    return `请在路网上点击${pathPicking.value === "start" ? "起点" : "终点"}`
  }
  if (drawMode.value === "point") return "单击地图完成点绘制"
  if (drawMode.value === "line") return "单击添加节点，右键结束线绘制"
  if (drawMode.value === "polygon") {
    return "单击添加顶点，右键闭合面绘制"
  }
  return ""
})

const showWktResult = computed(() =>
  Boolean(resultWkt.value) &&
  !["relation", "path"].includes(activeTab.value),
)

const RELATIONS: Record<string, [string, string, string]> = {
  equals: ["相等", "两个几何完全相等", "两个几何不完全相同"],
  disjoint: ["脱节", "两个几何没有共同点", "两个几何有共同点"],
  intersects: ["相交", "两个几何有共同点", "两个几何没有共同点"],
  touches: ["接触", "两个几何仅在边界处接触", "两个几何不只边界接触"],
  crosses: ["交叉", "两个几何交叉穿过", "两个几何不交叉"],
  within: ["内含", "几何 1 在几何 2 内", "几何 1 不完全在几何 2 内"],
  contains: ["包含", "几何 1 包含几何 2", "几何 1 不完全包含几何 2"],
  overlaps: ["重叠", "两个几何部分重叠", "两个几何不重叠"],
}

const relationRows = computed(() =>
  Object.entries(resultRelations.value).map(([key, value]) => {
    const relation = RELATIONS[key]
    return {
      name: relation?.[0] ?? key,
      value,
      description: value ? relation?.[1] ?? "" : relation?.[2] ?? "",
    }
  }),
)

const relationDescription = computed(() => {
  const result = resultRelations.value
  if (!result.intersects) return "两个几何不相交，没有共同部分"
  if (result.within) return "几何 1 完全在几何 2 内部"
  if (result.contains) return "几何 1 完全包含几何 2"
  if (result.equals) return "两个几何完全相等"
  if (result.touches) return "两个几何仅在边界处接触"
  if (result.overlaps) return "两个几何部分重叠"
  if (result.crosses) return "两个几何交叉"
  return "两个几何相交"
})

function formatCoordinate(coordinate: LonLat) {
  return `${coordinate[0].toFixed(5)}, ${coordinate[1].toFixed(5)}`
}

function flyToShenzhen() {
  viewer?.camera.flyTo({
    destination: Cartesian3.fromDegrees(114.05, 22.54, 90_000),
    orientation: TOP_DOWN_ORIENTATION,
  })
}

function pickLonLat(screenPosition: Cartesian2) {
  if (!viewer) return undefined
  const scene = viewer.scene
  let worldPosition: Cartesian3 | undefined

  if (scene.pickPositionSupported) {
    worldPosition = scene.pickPosition(screenPosition)
  }
  if (!worldPosition) {
    const ray = viewer.camera.getPickRay(screenPosition)
    if (ray) worldPosition = scene.globe.pick(ray, scene)
  }
  if (!worldPosition) return undefined
  return cartographicToLonLat(scene.globe.ellipsoid.cartesianToCartographic(
    worldPosition,
  ))
}

function asCartesian(coordinates: LonLat[]) {
  return coordinates.map(([longitude, latitude]) =>
    Cartesian3.fromDegrees(longitude, latitude),
  )
}

function removePreview() {
  if (!viewer) return
  if (previewEntity) viewer.entities.remove(previewEntity)
  for (const entity of vertexEntities) viewer.entities.remove(entity)
  previewEntity = undefined
  vertexEntities = []
}

function cancelDrawing() {
  removePreview()
  drawCoordinates = []
  floatingCoordinate = undefined
  drawMode.value = null
  drawSlot.value = null
}

function removeInputEntity(slot: GeometrySlot) {
  const entity = inputEntities.get(slot)
  if (entity && viewer) viewer.entities.remove(entity)
  inputEntities.delete(slot)
}

function addFixedGeometry(
  slot: GeometrySlot,
  kind: GeometryKind,
  coordinates: LonLat[],
) {
  if (!viewer) return
  removeInputEntity(slot)
  const positions = asCartesian(coordinates)
  let entity: Entity

  if (kind === "point") {
    entity = viewer.entities.add({
      position: positions[0],
      point: {
        pixelSize: 10,
        color: Color.DODGERBLUE,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
    })
  } else if (kind === "line") {
    entity = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Color.DODGERBLUE,
        clampToGround: true,
      },
    })
  } else {
    entity = viewer.entities.add({
      polygon: {
        hierarchy: positions,
        material: Color.DODGERBLUE.withAlpha(0.25),
        outline: true,
        outlineColor: Color.DODGERBLUE,
      },
    })
  }
  inputEntities.set(slot, entity)
}

function startDraw(
  slot: GeometrySlot,
  geometryType = "Polygon",
) {
  cancelDrawing()
  pathPicking.value = null
  removeInputEntity(slot)
  if (slot === 1) geomInput1.value = ""
  else geomInput2.value = ""

  try {
    drawMode.value = normalizeGeometryKind(geometryType)
    drawSlot.value = slot
    ElMessage.info(drawHint.value)
  } catch (error: any) {
    ElMessage.error(error.message)
  }
}

function createPreview() {
  if (!viewer || previewEntity || !drawMode.value) return
  if (drawMode.value === "line") {
    previewEntity = viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(
          () => asCartesian([
            ...drawCoordinates,
            ...(floatingCoordinate ? [floatingCoordinate] : []),
          ]),
          false,
        ),
        width: 3,
        material: Color.YELLOW,
        clampToGround: true,
      },
    })
  } else if (drawMode.value === "polygon") {
    previewEntity = viewer.entities.add({
      polygon: {
        hierarchy: new CallbackProperty(
          () =>
            new PolygonHierarchy(
              asCartesian([
                ...drawCoordinates,
                ...(floatingCoordinate ? [floatingCoordinate] : []),
              ]),
            ),
          false,
        ),
        material: Color.YELLOW.withAlpha(0.25),
        outline: true,
        outlineColor: Color.YELLOW,
      },
    })
  }
}

function addVertexMarker(coordinate: LonLat) {
  if (!viewer) return
  vertexEntities.push(
    viewer.entities.add({
      position: Cartesian3.fromDegrees(coordinate[0], coordinate[1]),
      point: {
        pixelSize: 7,
        color: Color.YELLOW,
        outlineColor: Color.BLACK,
        outlineWidth: 1,
      },
    }),
  )
}

function finishDrawing() {
  const kind = drawMode.value
  const slot = drawSlot.value
  if (!kind || !slot) return

  try {
    const wkt = coordinatesToWkt(kind, drawCoordinates, "EPSG:3857")
    if (slot === 1) geomInput1.value = wkt
    else geomInput2.value = wkt
    const coordinates = drawCoordinates.slice()
    cancelDrawing()
    addFixedGeometry(slot, kind, coordinates)
  } catch (error: any) {
    ElMessage.warning(error.message)
  }
}

function startPathPick(type: PathPoint) {
  cancelDrawing()
  removePathMarker(type)
  if (type === "start") pathStart.value = null
  else pathEnd.value = null
  pathPicking.value = type
  ElMessage.info(`请在路网上点击${type === "start" ? "起点" : "终点"}`)
}

function removePathMarker(type: PathPoint) {
  const entity = pathEntities.get(type)
  if (entity && viewer) viewer.entities.remove(entity)
  pathEntities.delete(type)
}

function setPathPoint(type: PathPoint, coordinate: LonLat) {
  if (!viewer) return
  removePathMarker(type)
  const isStart = type === "start"
  const entity = viewer.entities.add({
    position: Cartesian3.fromDegrees(coordinate[0], coordinate[1]),
    point: {
      pixelSize: 12,
      color: isStart ? Color.LIMEGREEN : Color.ORANGE,
      outlineColor: Color.WHITE,
      outlineWidth: 2,
    },
    label: {
      text: isStart ? "起点" : "终点",
      fillColor: Color.WHITE,
      outlineColor: Color.BLACK,
      outlineWidth: 2,
      pixelOffset: new Cartesian2(0, -24),
    },
  })
  pathEntities.set(type, entity)
  if (isStart) pathStart.value = coordinate
  else pathEnd.value = coordinate
  pathPicking.value = null
}

function handleLeftClick(screenPosition: Cartesian2) {
  const coordinate = pickLonLat(screenPosition)
  if (!coordinate) return

  if (pathPicking.value) {
    setPathPoint(pathPicking.value, coordinate)
    return
  }
  if (!drawMode.value) return

  drawCoordinates.push(coordinate)
  addVertexMarker(coordinate)
  floatingCoordinate = undefined
  if (drawMode.value === "point") {
    finishDrawing()
  } else {
    createPreview()
  }
}

function clearResult() {
  if (resultSource && viewer) {
    viewer.dataSources.remove(resultSource, true)
  }
  resultSource = undefined
  showResult.value = false
  resultWkt.value = ""
  resultRelations.value = {}
  pathCost.value = 0
  measureResult.value = ""
}

async function displayResult(
  wktText: string,
  projection: "EPSG:4326" | "EPSG:3857",
  path = false,
) {
  if (!viewer || !wktText) return
  if (resultSource) viewer.dataSources.remove(resultSource, true)
  const feature = wktToGeoJsonFeature(wktText, projection)
  resultSource = await GeoJsonDataSource.load(feature, {
    // 混合style，加载 Point 时只取点样式，加载 LineString 时只取线样式，加载 Polygon 时取填充和边界样式。
    stroke: path ? Color.ORANGE : Color.RED,
    fill: Color.RED.withAlpha(0.28),
    strokeWidth: path ? 6 : 4,
    markerColor: Color.RED,
    markerSize: 12,
    clampToGround: true,
  })
  await viewer.dataSources.add(resultSource)
  await viewer.flyTo(resultSource, { offset: TOP_DOWN_FIT_OFFSET })
}

function requireGeometry(second = false) {
  if (!geomInput1.value || (second && !geomInput2.value)) {
    ElMessage.warning(second ? "请绘制两个几何" : "请绘制输入几何")
    return false
  }
  return true
}

async function runNormalAnalysis() {
  switch (activeTab.value) {
    case "buffer": {
      if (!requireGeometry()) return false
      const response = await bufferAnalysis(
        geomInput1.value,
        bufferDistance.value,
      )
      resultWkt.value = response.data ?? ""
      await displayResult(resultWkt.value, "EPSG:3857")
      break
    }
    case "intersection":
    case "union":
    case "difference":
    case "symdifference": {
      if (!requireGeometry(true)) return false
      const api = {
        intersection: intersectionAnalysis,
        union: unionAnalysis,
        difference: differenceAnalysis,
        symdifference: symdiffAnalysis,
      }[activeTab.value]
      const response = await api(geomInput1.value, geomInput2.value)
      resultWkt.value = response.data ?? ""
      await displayResult(resultWkt.value, "EPSG:3857")
      break
    }
    case "relation": {
      if (!requireGeometry(true)) return false
      const response = await relationAnalysis(
        geomInput1.value,
        geomInput2.value,
      )
      resultRelations.value = response.data ?? {}
      break
    }
  }
  return true
}

async function runMeasurement() {
  if (!requireGeometry(measureType.value === "distance")) return false
  if (measureType.value === "distance") {
    const response = await distanceAnalysis(
      geomInput1.value,
      geomInput2.value,
    )
    measureResult.value = `${(response.data ?? 0).toFixed(2)} 米`
  } else if (measureType.value === "area") {
    const response = await areaAnalysis(geomInput1.value)
    measureResult.value = `${(response.data ?? 0).toFixed(2)} 平方米`
  } else if (measureType.value === "length") {
    const response = await lengthAnalysis(geomInput1.value)
    measureResult.value = `${(response.data ?? 0).toFixed(2)} 米`
  } else {
    const response = await centroidAnalysis(geomInput1.value)
    resultWkt.value = response.data ?? ""
    measureResult.value = `已标记中心点：${resultWkt.value}`
    await displayResult(resultWkt.value, "EPSG:3857")
  }
  return true
}

async function runPathAnalysis() {
  if (!pathStart.value || !pathEnd.value) {
    ElMessage.warning("请先在路网上选择起点和终点")
    return false
  }
  const response = await shortestPath(
    pathStart.value[0],
    pathStart.value[1],
    pathEnd.value[0],
    pathEnd.value[1],
  )
  resultWkt.value = response.data?.wkt ?? ""
  pathCost.value = response.data?.totalCost ?? 0
  await displayResult(resultWkt.value, "EPSG:4326", true)
  return true
}

async function doAnalysis() {
  cancelDrawing()
  clearResult()
  analysisLoading.value = true
  try {
    let completed: boolean
    if (activeTab.value === "path") {
      completed = await runPathAnalysis()
    } else if (activeTab.value === "measure") {
      completed = await runMeasurement()
    } else {
      completed = await runNormalAnalysis()
    }
    showResult.value = completed
  } catch (error: any) {
    console.error("空间分析失败:", error)
    ElMessage.error(error?.message || "空间分析失败")
  } finally {
    analysisLoading.value = false
  }
}

function clearAllInput() {
  cancelDrawing()
  geomInput1.value = ""
  geomInput2.value = ""
  pathStart.value = null
  pathEnd.value = null
  for (const slot of [1, 2] as const) removeInputEntity(slot)
  for (const type of ["start", "end"] as const) removePathMarker(type)
  clearResult()
}

function addRoadLayer() {
  if (!viewer || roadLayer) return
  const provider = new WebMapServiceImageryProvider({
    url: WMS_URL,
    layers: ROAD_LAYER,
    parameters: {
      version: "1.1.1",
      transparent: "true",
      format: "image/png",
      tiled: "true",
    },
  })
  let errorReported = false
  provider.errorEvent.addEventListener(() => {
    if (errorReported) return
    errorReported = true
    ElMessage.error("深圳路网加载失败，请检查 GeoServer 服务")
  })
  roadLayer = viewer.imageryLayers.addImageryProvider(provider)
}

function removeRoadLayer() {
  if (viewer && roadLayer) viewer.imageryLayers.remove(roadLayer, true)
  roadLayer = undefined
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer) return
  const restoreRoad = Boolean(roadLayer)
  roadLayer = undefined
  await item.activate(viewer)
  currentBasemapId.value = item.id
  if (restoreRoad) addRoadLayer()
}

function onTabChange() {
  clearAllInput()
  removeRoadLayer()
  if (activeTab.value === "path") {
    addRoadLayer()
    flyToShenzhen()
  }
}

onMounted(async () => {
  viewer = new Viewer("cesiumAnalysisMap", {
    baseLayer: false,
    animation: false,
    timeline: false,
    geocoder: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    navigationHelpButton: false,
    infoBox: false,
    selectionIndicator: false,
  })

  const defaultBasemap = CESIUM_BASEMAP_LIST.find(
    (item) => item.id === "mars3d",
  )
  if (defaultBasemap) await switchBasemap(defaultBasemap)
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(110, 35, 5_000_000),
    orientation: TOP_DOWN_ORIENTATION,
  })

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: any) => {
    handleLeftClick(movement.position)
  }, ScreenSpaceEventType.LEFT_CLICK)
  handler.setInputAction((movement: any) => {
    floatingCoordinate = pickLonLat(movement.endPosition)
  }, ScreenSpaceEventType.MOUSE_MOVE)
  handler.setInputAction(() => {
    if (drawMode.value && drawMode.value !== "point") finishDrawing()
  }, ScreenSpaceEventType.RIGHT_CLICK)
})

onUnmounted(() => {
  handler?.destroy()
  viewer?.destroy()
})
</script>

<style scoped lang="scss">
// 深度选择器样式，用于隐藏Cesium地球组件的默认UI元素
:deep(.cesium-viewer-bottom) { display: none !important; } // 隐藏底部工具栏
:deep(.cesium-viewer-toolbar) { display: none !important; } // 隐藏顶部工具栏

.analysis-workbench {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--el-bg-color);
}

.analysis-tabs {
  flex-shrink: 0;
  padding: 0 16px;

  :deep(.el-tabs__header) {
    margin-bottom: 0;
  }
}

.analysis-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.param-panel {
  z-index: 2;
  width: 340px;
  box-sizing: border-box;
  flex-shrink: 0;
  padding: 16px;
  overflow-y: auto;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.param-section {
  margin-bottom: 18px;
}

.param-label {
  margin-bottom: 7px;
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
}

.param-unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.geom-input,
.coord-tag {
  display: block;
  width: 100%;
  margin-top: 8px;
}

.coord-tag {
  box-sizing: border-box;
  height: auto;
  white-space: normal;
}

.path-note {
  margin-bottom: 18px;
  padding: 10px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}

.param-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}

.result-card {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--el-border-color-light);

  h3 {
    margin: 0 0 10px;
    font-size: 15px;
  }

  .el-table,
  .el-textarea,
  .path-result {
    margin-top: 10px;
  }
}

.path-result {
  padding: 10px;
  color: var(--el-color-success-dark-2);
  background: var(--el-color-success-light-9);
  border-radius: 6px;
}

.map-area {
  position: relative;
  flex: 1;
  min-width: 0;
}

.map-root {
  width: 100%;
  height: 100%;
}

.map-controls {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
}

.draw-hint {
  position: absolute;
  top: 14px;
  left: 50%;
  z-index: 10;
  transform: translateX(-50%);
}

@media (max-width: 900px) {
  .param-panel {
    width: 300px;
  }
}
</style>
