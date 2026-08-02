<template>
  <div class="spatial-editor">
    <aside class="table-panel">
      <div class="panel-header">
        <span>空间数据表</span>
        <el-button
          text
          :icon="Refresh"
          size="small"
          :loading="tableLoading"
          @click="loadTables"
        />
      </div>
      <el-input
        v-model="tableFilter"
        placeholder="搜索表名..."
        size="small"
        clearable
        prefix-icon="Search"
        class="panel-search"
      />
      <el-scrollbar class="panel-scroll">
        <el-menu
          :default-active="activeTable?.tableName || ''"
          @select="onTableSelect"
        >
          <el-menu-item
            v-for="table in filteredTables"
            :key="table.tableName"
            :index="table.tableName"
          >
            <el-tag :type="typeTag(table.geometryType)" size="small">
              {{ shortType(table.geometryType) }}
            </el-tag>
            <div class="table-label">
              <span>{{ table.name }}</span>
              <small v-if="table.name !== table.tableName">
                {{ table.tableName }}
              </small>
            </div>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </aside>

    <section class="main-area">
      <div class="map-area">
        <div id="cesiumCrudMap" class="map-root"></div>

        <div class="map-controls">
          <CesiumBasemapSwitcher
            :activate="switchBasemap"
            :initial="currentBasemapId"
          />
        </div>

        <div v-if="isDrawing" class="draw-toolbar">
          <el-tag type="warning">{{ drawHint }}</el-tag>
          <el-button size="small" @click="cancelDrawing">取消绘制</el-button>
        </div>
      </div>

      <div class="bottom-bar">
        <div class="toolbar">
          <el-button
            type="primary"
            size="small"
            :disabled="!activeTable || isDrawing"
            @click="startAddDraw"
          >
            添加
          </el-button>
          <el-button size="small" :disabled="!activeTable" @click="refreshData">
            刷新
          </el-button>
          <el-input
            v-model="searchText"
            placeholder="全字段搜索..."
            size="small"
            clearable
            class="search-input"
            @clear="refreshData"
            @keyup.enter="doSearch"
          />
          <el-button size="small" :disabled="!activeTable" @click="doSearch">
            搜索
          </el-button>
          <span v-if="activeTable" class="total-hint">
            {{ activeTable.name }} · 共 {{ totalRows }} 条
          </span>
        </div>

        <el-table
          ref="tableRef"
          v-loading="dataLoading"
          :data="tableRows"
          border
          stripe
          size="small"
          height="230"
          highlight-current-row
          empty-text="请选择空间表"
          @row-click="onRowClick"
        >
          <el-table-column type="index" label="#" width="48" />
          <el-table-column
            v-for="field in tableFields"
            :key="field.name"
            :prop="field.name"
            :label="field.name"
            min-width="110"
            show-overflow-tooltip
          />
          <el-table-column label="操作" width="176" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click.stop="openEdit(row)">
                编辑
              </el-button>
              <el-button
                size="small"
                type="warning"
                link
                @click.stop="startRedraw(row)"
              >
                重绘
              </el-button>
              <el-button size="small" type="danger" link @click.stop="removeRow(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="totalRows"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          size="small"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>
    </section>

    <el-dialog
      v-model="editDialogVisible"
      :title="isAdd ? '添加要素' : '编辑要素'"
      width="55%"
      :close-on-click-modal="false"
      @closed="onEditClosed"
    >
      <el-alert
        v-if="pendingWkt"
        title="几何已绘制，保存时将以 EPSG:4326 WKT 写入数据库"
        type="success"
        :closable="false"
        show-icon
        class="dialog-alert"
      />
      <el-form label-position="top" size="small">
        <el-form-item
          v-for="field in formFields"
          :key="field.name"
          :label="field.name"
        >
          <el-input v-model="editForm[field.name]" />
        </el-form-item>
        <el-form-item label="WKT">
          <el-input
            :model-value="pendingWkt"
            type="textarea"
            :rows="3"
            readonly
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveEdit">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { Refresh } from "@element-plus/icons-vue"
import {
  CallbackProperty,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  GeoJsonDataSource,
  HeadingPitchRange,
  HeightReference,
  Math as CesiumMath,
  PointGraphics,
  PolylineGraphics,
  PolygonHierarchy,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import {
  CESIUM_BASEMAP_LIST,
  type CesiumBasemapItem,
} from "@/utils/cesium-basemaps"
import {
  addTableRow,
  deleteTableRow,
  getSpatialTables,
  getTableData,
  getTableFields,
  searchTableData,
  updateTableRow,
  type FieldInfoVO,
  type PageResultVO,
  type SpatialTableVO,
} from "@/api/spatial-data"
import {
  cartographicToLonLat,
  coordinatesToWkt,
  normalizeGeometryKind,
  wktToGeoJsonFeature,
  type GeometryKind,
  type LonLat,
} from "./cesium-fullstack-geometry"

type DrawPurpose = "add" | "redraw" | null

const TOP_DOWN_ORIENTATION = {
  heading: 0,
  pitch: -CesiumMath.PI_OVER_TWO,
  roll: 0,
}

// range 为 0 时，Cesium 根据整批要素范围自动计算俯视距离。
const TOP_DOWN_FIT_OFFSET = new HeadingPitchRange(
  0,
  -CesiumMath.PI_OVER_TWO,
  0,
)

const DEFAULT_FEATURE_COLOR = Color.fromCssColorString("#3388ff")
const DEFAULT_BOUNDARY_COLOR = Color.fromCssColorString("#91caff")
const SELECTED_FEATURE_COLOR = Color.fromCssColorString("#e74c3c")

const tableFilter = ref("")
const allTables = ref<SpatialTableVO[]>([])
const activeTable = ref<SpatialTableVO | null>(null)
const searchText = ref("")
const isSearching = ref(false)
const tableRows = ref<Record<string, any>[]>([])
const displayFields = ref<FieldInfoVO[]>([])
const totalRows = ref(0)
const currentPage = ref(1)
const pageSize = ref(50)
const tableLoading = ref(false)
const dataLoading = ref(false)
const saving = ref(false)
const tableRef = ref<any>(null)

const editDialogVisible = ref(false)
const isAdd = ref(false)
const editForm = ref<Record<string, any>>({})
const editingRow = ref<Record<string, any> | null>(null)
const pendingWkt = ref("")

const currentBasemapId = ref("")
const drawMode = ref<GeometryKind | "none">("none")
const drawPurpose = ref<DrawPurpose>(null)

let viewer: Viewer | undefined
let handler: ScreenSpaceEventHandler | undefined
let featureSource: GeoJsonDataSource | undefined
let previewEntity: Entity | undefined
let pendingEntity: Entity | undefined
let vertexEntities: Entity[] = []
let activePositions: Cartesian3[] = []
let cursorPosition: Cartesian3 | undefined
let loadSequence = 0
let selectedFeatureIds = new Set<string>()

const filteredTables = computed(() => {
  const keyword = tableFilter.value.trim().toLowerCase()
  if (!keyword) return allTables.value
  return allTables.value.filter((table) =>
    `${table.name} ${table.tableName}`.toLowerCase().includes(keyword),
  )
})

const tableFields = computed(() =>
  displayFields.value.filter((field) => !field.geom),
)

const formFields = computed(() =>
  displayFields.value.filter((field) => !field.geom && !field.pk),
)

const saveFields = computed(() =>
  formFields.value.map((field) => field.name),
)

const isDrawing = computed(() => drawMode.value !== "none")

const drawHint = computed(() => {
  if (drawMode.value === "point") return "点击地图放置点"
  if (drawMode.value === "line") return "左键添加折线顶点，右键完成"
  if (drawMode.value === "polygon") return "左键添加面顶点，右键完成"
  return ""
})

function shortType(geometryType: string | null | undefined) {
  try {
    const kind = normalizeGeometryKind(geometryType)
    return kind === "point" ? "点" : kind === "line" ? "线" : "面"
  } catch {
    return "?"
  }
}

function typeTag(
  geometryType: string | null | undefined,
): "success" | "warning" | "info" | "danger" {
  try {
    const kind = normalizeGeometryKind(geometryType)
    if (kind === "point") return "danger"
    if (kind === "line") return "warning"
    return "success"
  } catch {
    return "info"
  }
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer) return
  await item.activate(viewer)
  currentBasemapId.value = item.id
}

async function loadTables() {
  tableLoading.value = true
  try {
    const response = await getSpatialTables()
    allTables.value = response.data || []
    const defaultTable = allTables.value.find(
      (table) => table.tableName === "capital",
    ) || allTables.value[0]
    if (defaultTable) {
      await onTableSelect(defaultTable.tableName)
    }
  } catch (error) {
    console.error("空间表加载失败:", error)
    ElMessage.error("获取空间表列表失败")
  } finally {
    tableLoading.value = false
  }
}

async function onTableSelect(tableName: string) {
  const table = allTables.value.find((item) => item.tableName === tableName)
  if (!table) return

  activeTable.value = table
  currentPage.value = 1
  searchText.value = ""
  isSearching.value = false
  cancelDrawing()
  await loadData()
}

async function loadData() {
  const table = activeTable.value
  if (!table) return

  // 增加序号，确保异步请求的响应顺序正确，避免旧请求覆盖新请求。
  const sequence = ++loadSequence
  dataLoading.value = true
  try {
    const [pageResponse, fieldResponse] = await Promise.all([
      getTableData(table.tableName, currentPage.value, pageSize.value),
      getTableFields(table.tableName),
    ])
    if (sequence !== loadSequence) return
    applyPageResult(pageResponse.data, fieldResponse.data)
  } catch (error) {
    console.error("空间数据加载失败:", error)
    ElMessage.error("获取空间数据失败")
  } finally {
    if (sequence === loadSequence) dataLoading.value = false
  }
}

async function doSearch() {
  const table = activeTable.value
  if (!table) return
  const keyword = searchText.value.trim()
  if (!keyword) {
    isSearching.value = false
    await loadData()
    return
  }

  isSearching.value = true
  currentPage.value = 1
  dataLoading.value = true
  try {
    const response = await searchTableData(
      table.tableName,
      keyword,
      currentPage.value,
      pageSize.value,
    )
    applyPageResult(response.data, response.data?.fields)
  } catch (error) {
    console.error("空间数据搜索失败:", error)
    ElMessage.error("搜索失败")
  } finally {
    dataLoading.value = false
  }
}

function refreshData() {
  if (isSearching.value && searchText.value.trim()) {
    doSearch()
  } else {
    loadData()
  }
}

function applyPageResult(
  result: PageResultVO | undefined,
  fields: FieldInfoVO[] | undefined,
) {
  tableRows.value = result?.rows || []
  displayFields.value = fields || result?.fields || []
  totalRows.value = result?.total || 0
  nextTick(loadFeaturesToMap)
}

function getEntityRowKey(entity: Entity) {
  if (!viewer) return String(entity.id)
  const property = (entity.properties as any)?.rowKey
  const value = property?.getValue(viewer.clock.currentTime)
  return value == null ? String(entity.id) : String(value)
}

function addPolygonBoundary(entity: Entity) {
  if (!viewer || !entity.polygon || entity.polyline) return

  const hierarchy = entity.polygon.hierarchy?.getValue(
    viewer.clock.currentTime,
  )
  const positions = hierarchy?.positions
  if (!positions || positions.length < 2) return

  entity.polyline = new PolylineGraphics({
    positions: new ConstantProperty([...positions, positions[0]]),
    clampToGround: new ConstantProperty(true),
  })
}

function applyFeatureStyle(entity: Entity, selected = false) {
  // 表格行和地图要素共用这一套状态：普通态为蓝色，选中态为红色。
  // setSelectedFeature() 会先恢复旧要素，再把当前业务记录对应的所有
  // Cesium Entity 设为选中态；MultiPolygon 可能对应多个 Entity。
  const color = selected ? SELECTED_FEATURE_COLOR : DEFAULT_FEATURE_COLOR

  // GeoJsonDataSource 默认将 GeoJSON Point 生成为 billboard（图钉）。
  // CRUD 页想与 OL 版保持一致，统一改成贴地圆点；若该 Entity 已经有
  // PointGraphics，也一并更新，保证重新选中、取消选中时视觉状态一致。
  if (entity.billboard || entity.point) {
    entity.billboard = undefined
    entity.point = new PointGraphics({
      color,
      // 选中时略微放大，避免只靠颜色区分而不够醒目。
      pixelSize: selected ? 12 : 9,
      // 白色描边使蓝点或红点在深色影像与深色底图上都可辨认。
      outlineColor: Color.WHITE,
      outlineWidth: 2,
      // 点直接贴到地形/椭球表面，不使用数据本身可能携带的高程。
      heightReference: HeightReference.CLAMP_TO_GROUND,
    })
  }

  // 纯线要素（如 roads）只需要设置线材质、宽度和贴地行为。
  // 面要素下方也会附加一个 polyline 边界，但会在后面的专门分支中
  // 使用更醒目的边界样式覆盖这里的默认线样式。
  if (entity.polyline) {
    // ColorMaterialProperty → 一种“纯色材质”，可用于线和面绘制
    entity.polyline.material = new ColorMaterialProperty(color)
    // ConstantProperty → 永远返回同一个值，数字、布尔值、固定坐标、固定颜色等
    entity.polyline.width = new ConstantProperty(selected ? 4 : 2.5)
    entity.polyline.clampToGround = new ConstantProperty(true)
  }

  if (entity.polygon) {
    // GeoJsonDataSource 自带的 Polygon outline 在贴地时不够稳定、也不够
    // 显眼，因此为面补充独立的 PolylineGraphics 边界。该函数只在首次
    // 遇到面时创建，后续样式刷新复用同一条边界线。
    addPolygonBoundary(entity)

    // 面内部保持较低透明度，既能看出行政区范围，又不遮住底图细节。
    entity.polygon.material = new ColorMaterialProperty(
      color.withAlpha(selected ? 0.24 : 0.15),
    )
    // 仍保留 Cesium 原生 outline 作为兜底；真正清晰的贴地边界由下面的
    // polyline 负责。
    entity.polygon.outline = new ConstantProperty(true)
    entity.polygon.outlineColor = new ConstantProperty(
      selected ? color : DEFAULT_BOUNDARY_COLOR,
    )
  }

  // 只有“面 + 已创建的独立边界线”才进入这里。普通态用浅蓝色边界，
  // 选中态改为红色并加粗；这也是省界能够清晰辨认的关键。
  if (entity.polygon && entity.polyline) {
    const boundaryColor = selected ? color : DEFAULT_BOUNDARY_COLOR
    entity.polyline.material = new ColorMaterialProperty(boundaryColor)
    entity.polyline.width = new ConstantProperty(selected ? 5 : 3)
    entity.polyline.clampToGround = new ConstantProperty(true)
  }
}

function setSelectedFeature(entity: Entity) {
  if (!featureSource) return
  const source = featureSource

  selectedFeatureIds.forEach((id) => {
    const previous = source.entities.getById(id)
    if (previous) applyFeatureStyle(previous)
  })

  const rowKey = getEntityRowKey(entity)
  const entities = source.entities.values.filter(
    (item) => getEntityRowKey(item) === rowKey,
  )
  selectedFeatureIds = new Set(entities.map((item) => String(item.id)))
  entities.forEach((item) => applyFeatureStyle(item, true))
  viewer!.selectedEntity = entity
}

async function loadFeaturesToMap() {
  if (!viewer) return

  if (featureSource) {
    viewer.dataSources.remove(featureSource, true)
    featureSource = undefined
  }
  selectedFeatureIds.clear()

  const table = activeTable.value
  if (!table || tableRows.value.length === 0) return

  const features: any[] = []
  for (const row of tableRows.value) {
    if (!row.wkt) continue
    try {
      const feature = wktToGeoJsonFeature(row.wkt, "EPSG:4326")
      const rowKey = String(row[table.rowKeyColumn])
      feature.id = rowKey
      feature.properties = {
        rowKey,
        rowIndex: tableRows.value.indexOf(row),
      }
      features.push(feature)
    } catch (error) {
      console.warn("跳过无法解析的 WKT:", row.wkt, error)
    }
  }
  if (features.length === 0) return

  featureSource = await GeoJsonDataSource.load(
    {
      type: "FeatureCollection",
      features,
    } as any,
    {
      markerColor: Color.fromCssColorString("#409eff"),
      markerSize: 10,
      stroke: Color.fromCssColorString("#409eff"),
      fill: Color.fromCssColorString("#409eff").withAlpha(0.22),
      strokeWidth: 3,
      clampToGround: true,
    },
  )
  // 上面的 GeoJsonDataSource.load(..., options) 中的是加载时的默认混合样式：
  //  它让 Cesium 能根据 GeoJSON 类型先创建对应的默认点、线、面 Entity。
  // 而这里的 applyFeatureStyle(entity) 是专门用于 CRUD 交互的二次逐 Entity 样式控制，
  //  主要补充了默认样式做不到或不方便做的事：
  //  - 把 Cesium GeoJSON 点默认的图钉改成与 OL 接近的圆点；
  //  - 面额外创建/强化贴地边界线；
  //  - 选中表格行时改为红色；
  //  - 对 MultiPolygon 拆出的多个 Entity 一起高亮；
  //  - 取消选中时恢复普通样式。
  featureSource.entities.values.forEach((entity) => applyFeatureStyle(entity))
  await viewer.dataSources.add(featureSource)
  await viewer.flyTo(featureSource, { offset: TOP_DOWN_FIT_OFFSET })
}

function onRowClick(row: Record<string, any>) {
  const table = activeTable.value
  if (!viewer || !table || !featureSource) return

  tableRef.value?.setCurrentRow(row)
  const rowKey = String(row[table.rowKeyColumn])
  const entity = featureSource.entities.values.find(
    (item) => getEntityRowKey(item) === rowKey,
  )
  if (!entity) return
  setSelectedFeature(entity)
}

function selectRowFromEntity(entity: Entity) {
  const table = activeTable.value
  if (!table) return
  const row = tableRows.value.find(
    (item) => String(item[table.rowKeyColumn]) === getEntityRowKey(entity),
  )
  if (!row) return

  setSelectedFeature(entity)
  tableRef.value?.setCurrentRow(row)
  nextTick(() => {
    const wrapper = tableRef.value?.$el?.querySelector(
      ".el-table__body-wrapper",
    )
    const rowElement = wrapper?.querySelector(".current-row")
    rowElement?.scrollIntoView({ block: "nearest", behavior: "smooth" })
  })
}

function openEdit(row: Record<string, any>) {
  isAdd.value = false
  editingRow.value = row
  editForm.value = {}
  for (const field of formFields.value) {
    editForm.value[field.name] = row[field.name]
  }
  pendingWkt.value = row.wkt || ""
  editDialogVisible.value = true
}

function startAddDraw() {
  isAdd.value = true
  editingRow.value = null
  editForm.value = {}
  beginDrawing("add")
}

function startRedraw(row: Record<string, any>) {
  isAdd.value = false
  editingRow.value = row
  editForm.value = {}
  for (const field of formFields.value) {
    editForm.value[field.name] = row[field.name]
  }
  beginDrawing("redraw")
}

function beginDrawing(purpose: Exclude<DrawPurpose, null>) {
  const table = activeTable.value
  if (!table) {
    ElMessage.warning("请先选择空间表")
    return
  }
  cancelDrawing()
  try {
    drawMode.value = normalizeGeometryKind(table.geometryType)
    drawPurpose.value = purpose
    if (
      viewer &&
      featureSource &&
      viewer.dataSources.contains(featureSource)
    ) {
      viewer.dataSources.remove(featureSource, false)
    }
    ElMessage.info(drawHint.value)
  } catch (error: any) {
    ElMessage.error(error.message)
  }
}

function pickWorldPosition(screenPosition: Cartesian2) {
  if (!viewer) return undefined
  const scene = viewer.scene
  if (scene.pickPositionSupported) {
    const picked = scene.pickPosition(screenPosition)
    if (picked) return picked
  }
  const ray = viewer.camera.getPickRay(screenPosition)
  if (ray) {
    const terrainPosition = scene.globe.pick(ray, scene)
    if (terrainPosition) return terrainPosition
  }
  return viewer.camera.pickEllipsoid(screenPosition, scene.globe.ellipsoid)
}

function addVertex(position: Cartesian3) {
  const entity = viewer?.entities.add({
    position,
    point: {
      pixelSize: 8,
      color: Color.WHITE,
      outlineColor: Color.fromCssColorString("#409eff"),
      outlineWidth: 2,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })
  if (entity) vertexEntities.push(entity)
}

function createPreview() {
  if (!viewer || previewEntity || drawMode.value === "point") return
  if (drawMode.value === "line") {
    previewEntity = viewer.entities.add({
      polyline: {
        positions: new CallbackProperty(
          () => cursorPosition
            ? [...activePositions, cursorPosition]
            : activePositions,
          false,
        ),
        width: 3,
        material: Color.fromCssColorString("#409eff"),
        clampToGround: true,
      },
    })
    return
  }
  previewEntity = viewer.entities.add({
    polygon: {
      hierarchy: new CallbackProperty(
        () => new PolygonHierarchy(
          cursorPosition
            ? [...activePositions, cursorPosition]
            : activePositions,
        ),
        false,
      ),
      material: Color.fromCssColorString("#409eff").withAlpha(0.25),
      outline: true,
      outlineColor: Color.fromCssColorString("#409eff"),
    },
  })
}

function handleLeftClick(event: { position: Cartesian2 }) {
  if (!viewer) return
  if (drawMode.value === "none") {
    const picked = viewer.scene.pick(event.position)
    if (picked?.id instanceof Entity) {
      selectRowFromEntity(picked.id)
    }
    return
  }

  const position = pickWorldPosition(event.position)
  if (!position) return
  activePositions.push(position)
  addVertex(position)

  if (drawMode.value === "point") {
    finishDrawing()
  } else {
    createPreview()
  }
}

function handleMouseMove(event: { endPosition: Cartesian2 }) {
  if (drawMode.value === "none" || drawMode.value === "point") return
  if (!activePositions.length) return
  cursorPosition = pickWorldPosition(event.endPosition)
}

function finishDrawing() {
  if (!viewer || drawMode.value === "none") return
  const kind = drawMode.value
  const minimum = kind === "polygon" ? 3 : kind === "line" ? 2 : 1
  if (activePositions.length < minimum) {
    ElMessage.warning(`${shortType(kind)}至少需要 ${minimum} 个点`)
    return
  }

  const positions = activePositions.slice()
  const lonLat = positions.map((position) =>
    cartographicToLonLat(Cartographic.fromCartesian(position)),
  ) as LonLat[]
  pendingWkt.value = coordinatesToWkt(kind, lonLat, "EPSG:4326")
  showPendingEntity(kind, positions)
  clearDrawingPreview()
  drawMode.value = "none"
  drawPurpose.value = null
  editDialogVisible.value = true
}

function showPendingEntity(kind: GeometryKind, positions: Cartesian3[]) {
  if (!viewer) return
  if (pendingEntity) viewer.entities.remove(pendingEntity)

  if (kind === "point") {
    pendingEntity = viewer.entities.add({
      position: positions[0],
      point: {
        pixelSize: 12,
        color: Color.YELLOW,
        outlineColor: Color.WHITE,
        outlineWidth: 2,
      },
    })
  } else if (kind === "line") {
    pendingEntity = viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        material: Color.YELLOW,
        clampToGround: true,
      },
    })
  } else {
    pendingEntity = viewer.entities.add({
      polygon: {
        hierarchy: new PolygonHierarchy(positions),
        material: Color.YELLOW.withAlpha(0.3),
        outline: true,
        outlineColor: Color.YELLOW,
      },
    })
  }
}

function clearDrawingPreview() {
  if (viewer && previewEntity) viewer.entities.remove(previewEntity)
  previewEntity = undefined
  for (const entity of vertexEntities) {
    viewer?.entities.remove(entity)
  }
  vertexEntities = []
  activePositions = []
  cursorPosition = undefined
}

function cancelDrawing() {
  clearDrawingPreview()
  drawMode.value = "none"
  drawPurpose.value = null
  if (featureSource && viewer && !viewer.dataSources.contains(featureSource)) {
    viewer.dataSources.add(featureSource)
  }
}

function onEditClosed() {
  cancelDrawing()
  if (viewer && pendingEntity) viewer.entities.remove(pendingEntity)
  pendingEntity = undefined
  pendingWkt.value = ""
  editForm.value = {}
  editingRow.value = null
}

async function saveEdit() {
  const table = activeTable.value
  if (!table || !pendingWkt.value) {
    ElMessage.warning("请先绘制几何")
    return
  }

  saving.value = true
  const dto = {
    geomColumn: table.geomColumn,
    rowKeyColumn: table.rowKeyColumn,
    rowKeyValue: editingRow.value?.[table.rowKeyColumn] ?? null,
    newRow: { ...editForm.value },
    fields: saveFields.value,
    wkt: pendingWkt.value,
  }
  try {
    if (isAdd.value) {
      await addTableRow(table.tableName, dto)
      ElMessage.success("添加成功")
    } else {
      await updateTableRow(table.tableName, dto)
      ElMessage.success("保存成功")
    }
    editDialogVisible.value = false
    await refreshAfterMutation()
  } catch (error: any) {
    ElMessage.error(error?.message || "保存失败")
  } finally {
    saving.value = false
  }
}

async function removeRow(row: Record<string, any>) {
  const table = activeTable.value
  if (!table) return

  try {
    await ElMessageBox.confirm("此操作将永久删除该记录，是否继续？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    })
  } catch {
    return
  }

  try {
    await deleteTableRow(table.tableName, {
      geomColumn: table.geomColumn,
      rowKeyColumn: table.rowKeyColumn,
      rowKeyValue: row[table.rowKeyColumn],
      newRow: {},
      fields: [],
    })
    ElMessage.success("删除成功")
    await refreshAfterMutation()
  } catch (error: any) {
    ElMessage.error(error?.message || "删除失败")
  }
}

async function refreshAfterMutation() {
  if (isSearching.value && searchText.value.trim()) {
    await doSearch()
  } else {
    await loadData()
  }
}

onMounted(async () => {
  viewer = new Viewer("cesiumCrudMap", {
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
  viewer.scene.canvas.oncontextmenu = () => false

  const defaultBasemap = CESIUM_BASEMAP_LIST.find(
    (item) => item.id === "mars3d",
  )
  if (defaultBasemap) await switchBasemap(defaultBasemap)

  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(110, 35, 8_000_000),
    orientation: TOP_DOWN_ORIENTATION,
  })

  handler = new ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction(handleLeftClick, ScreenSpaceEventType.LEFT_CLICK)
  handler.setInputAction(handleMouseMove, ScreenSpaceEventType.MOUSE_MOVE)
  handler.setInputAction(finishDrawing, ScreenSpaceEventType.RIGHT_CLICK)

  await loadTables()
})

onUnmounted(() => {
  handler?.destroy()
  viewer?.destroy()
  viewer = undefined
})
</script>

<style scoped lang="scss">
// 深度选择器样式，用于隐藏Cesium地球组件的默认UI元素
:deep(.cesium-viewer-bottom) { display: none !important; } // 隐藏底部工具栏
:deep(.cesium-viewer-toolbar) { display: none !important; } // 隐藏顶部工具栏

.spatial-editor {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color);
}

.table-panel {
  display: flex;
  flex: 0 0 250px;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--el-border-color-light);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 10px;
  font-size: 16px;
  font-weight: 600;
}

.panel-search {
  width: calc(100% - 24px);
  margin: 0 12px 10px;
}

.panel-scroll {
  flex: 1;
  min-height: 0;
}

:deep(.el-menu) {
  border-right: 0;
}

:deep(.el-menu-item) {
  gap: 10px;
  height: auto;
  min-height: 52px;
  padding-top: 6px;
  padding-bottom: 6px;
  line-height: 1.3;
}

.table-label {
  min-width: 0;
}

.table-label span,
.table-label small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-label small {
  margin-top: 3px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.main-area {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.map-area {
  position: relative;
  flex: 1;
  min-height: 240px;
  overflow: hidden;
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

.draw-toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: var(--el-bg-color-overlay);
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  box-shadow: var(--el-box-shadow-light);
}

.bottom-bar {
  flex: 0 0 310px;
  min-height: 0;
  padding: 10px 12px;
  overflow: hidden;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color-light);
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.search-input {
  width: 220px;
}

.total-hint {
  margin-left: auto;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

:deep(.el-pagination) {
  justify-content: flex-end;
  margin-top: 8px;
}

:deep(.el-table__body tr.current-row > td.el-table__cell) {
  background: rgb(231 76 60 / 18%) !important;
}

:deep(.el-table__body tr.current-row > td.el-table__cell .cell) {
  color: var(--el-color-danger);
  font-weight: 600;
}

.dialog-alert {
  margin-bottom: 12px;
}

@media (max-width: 900px) {
  .table-panel {
    flex-basis: 210px;
  }

  .bottom-bar {
    flex-basis: 300px;
  }

  .total-hint {
    display: none;
  }
}
</style>
