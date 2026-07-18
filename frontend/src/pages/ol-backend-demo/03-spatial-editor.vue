<template>
  <div class="spatial-editor">
    <!-- 左面板：空间表列表 -->
    <div class="table-panel">
      <div class="panel-header">
        <span>空间数据表</span>
        <el-button text :icon="Refresh" size="small" @click="loadTables" />
      </div>
      <el-input v-model="tableFilter" placeholder="搜索表名..." size="small" clearable prefix-icon="Search"
        class="panel-search" />
      <el-scrollbar class="panel-scroll">
        <!-- el-menu 的 @select 回调参数就是被点击菜单项的 :index 值 -->
        <el-menu :default-active="activeTable?.tableName ?? ''" @select="onTableSelect">
          <el-menu-item v-for="t in filteredTables" :key="t.tableName" :index="t.tableName">
            <el-tag :type="typeTag(t.geometryType)" size="small">
              {{ shortType(t.geometryType) }}
            </el-tag>
            <span class="table-name">{{ t.name }}</span>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
    </div>

    <div class="main-area">
      <div id="spatial-map" class="map-container">
        <SearchBox v-if="map" :map="map" />
        <!-- 几何编辑工具栏 -->
        <div v-if="isEditingGeom" class="geom-edit-toolbar">
          <el-tag type="warning" size="default">正在编辑几何</el-tag>
          <el-button size="small" type="success" @click="confirmGeomEdit">确认</el-button>
          <el-button size="small" @click="cancelGeomEdit">取消</el-button>
        </div>
        <div class="map-controls-right">
          <BasemapSwitcher :set-base-layer="setBaseLayer" />
          <BasicToolBox v-if="map" :map="map" />
          <MapSetting v-if="map" :map="map" />
        </div>
      </div>

      <div class="bottom-bar">
        <div class="toolbar">
          <el-button :type="isDrawing ? 'danger' : 'primary'" size="small"
            @click="isDrawing ? cancelDraw() : startAddDraw()">
            {{ isDrawing ? '取消绘制' : '添加' }}
          </el-button>
          <el-button size="small" @click="refreshData">刷新</el-button>
          <el-input v-model="searchText" placeholder="全字段搜索..." size="small" clearable style="width: 200px"
            @clear="refreshData" @keyup.enter="doSearch" />
          <el-button size="small" @click="doSearch">搜索</el-button>
          <span v-if="activeTable" class="total-hint">共 {{ totalRows }} 条</span>
        </div>

        <el-table ref="tableRef" :data="tableRows" border stripe max-height="280" size="small" highlight-current-row
          @row-click="onRowClick" @selection-change="onSelectionChange" height="260">
          <el-table-column type="selection" width="36" />
          <el-table-column type="index" label="#" width="44" />
          <!-- ``:prop="col.name"绑定 Element Plus 的prop` 属性，指定这一列从行数据中取哪个字段。 -->
          <el-table-column v-for="col in displayFields" :key="col.name" :prop="col.name" :label="col.name"
            show-overflow-tooltip min-width="80" />
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <!-- .stop是阻止事件冒泡的修饰符，防止事件向上冒泡导致不必要的触发 -->
              <el-button size="small" type="primary" link @click.stop="onEdit(row)">编辑</el-button>
              <el-button size="small" type="warning" link @click.stop="onEditGeom(row)">几何</el-button>
              <el-button size="small" type="danger" link @click.stop="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :total="totalRows"
          :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next, jumper" background small
          @current-change="loadData" @size-change="loadData" />
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editDialogVisible" :title="isAdd ? '添加要素' : '编辑要素'" width="55%" :close-on-click-modal="false"
      @close="onEditClose">
      <el-alert v-if="isAdd && pendingWkt" type="success" :closable="false" show-icon title="几何已绘制，请填写属性字段"
        style="margin-bottom: 12px" />
      <el-form :model="editForm" label-width="120px" size="small" label-position="top">
        <el-form-item v-for="f in formFields" :key="f.name" :label="f.name">
          <el-input v-model="editForm[f.name]" />
        </el-form-item>
        <!-- 几何字段只展示状态，不可修改 -->
        <el-form-item label="几何">
          <el-tag :type="pendingWkt ? 'success' : 'info'">
            {{ pendingWkt ? '已绘制' : '未绘制（点击地图上的要素修改）' }}
          </el-tag>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDraw">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 03-spatial-editor — 后端空间数据 CRUD
 *
 * 添加流程：点击"添加" → 地图绘制几何 → 弹窗填属性 → 保存
 * 编辑流程：点击"编辑" → 弹窗改属性 + 地图改几何 → 保存
 * 所有几何存储为 EPSG:4326，地图显示自动转换为 EPSG:3857
 */
import { ref, shallowRef, computed, onMounted, nextTick } from "vue"
import { ElMessage, ElMessageBox } from "element-plus"
import { Refresh } from "@element-plus/icons-vue"

import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue"
import MapSetting from "@/components/MapSetting.vue"
import SearchBox from "@/components/SearchBox.vue"

import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import WKT from "ol/format/WKT"
import Draw from "ol/interaction/Draw"
import Modify from "ol/interaction/Modify"
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style"

import {
  getSpatialTables, getTableData, searchTableData,
  addTableRow, updateTableRow, deleteTableRow,
  type SpatialTableVO, type FieldInfoVO, type PageResultVO,
} from "@/api/spatial-data"

// ── 地图 ──────────────────────────────────────────────────────

const { map, setBaseLayer } = useMap("spatial-map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 },
})

// ── 状态 ──────────────────────────────────────────────────────

// 表列表 & 搜索
const tableFilter = ref("")                                          // 左侧面板搜索关键字
const allTables = ref<SpatialTableVO[]>([])                          // layer_catalog 所有注册表
const activeTable = ref<SpatialTableVO | null>(null)                 // 当前选中的表
const searchText = ref("")                                           // 属性搜索关键字
const isSearching = ref(false)                                       // 是否处于搜索模式

// 表格分页
const tableRef = ref<any>(null)                                      // el-table 实例
const tableRows = ref<Record<string, any>[]>([])                     // 当前页数据行
const displayFields = ref<FieldInfoVO[]>([])                         // 当前表字段列表
const totalRows = ref(0)                                             // 总记录数
const currentPage = ref(1)                                           // 当前页码
const pageSize = ref(50)                                             // 每页条数
const selectedRows = ref<Record<string, any>[]>([])                  // 多选选中行

// 编辑弹窗
const editDialogVisible = ref(false)
const isAdd = ref(false)                                             // true=新增 / false=编辑，编辑弹窗中使用
const isDrawing = ref(false)                                         // 是否正在地图绘制
const isEditingGeom = ref(false)                                     // 是否正在编辑几何，用于控制几何工具栏显示
const editForm = ref<Record<string, any>>({})                        // 弹窗表单数据
const editingRow = ref<Record<string, any> | null>(null)             // 正在编辑的原始行
const pendingWkt = ref("")                                           // 待保存的 WKT 几何

// OL 地图对象（shallowRef 避免 Vue proxy 干扰 OL 内部状态）
const vectorLayer = shallowRef<VectorLayer<VectorSource> | null>(null)
const wktFormat = new WKT()                                          // WKT 解析器（纯工具，无需响应式）
let drawInteraction: Draw | null = null                              // 当前绘制交互（let，频繁创建销毁）
let modifyInteraction: Modify | null = null                          // 当前修改交互
const tempDrawLayer = shallowRef<VectorLayer<VectorSource> | null>(null)

// ── 计算属性 ──────────────────────────────────────────────────

const filteredTables = computed(() => {
  if (!tableFilter.value) return allTables.value // 未输入关键字时返回全部表
  const kw = tableFilter.value.toLowerCase()
  return allTables.value.filter(t => t.name.toLowerCase().includes(kw))
})

/** 编辑弹窗中显示的字段（排除几何、主键） */
const formFields = computed(() =>
  displayFields.value.filter(f => !f.geom && !f.pk))
/** 提交时写入的字段（排除几何、主键） */
const saveFields = computed(() =>
  displayFields.value.filter(f => !f.geom && !f.pk).map(f => f.name))

// ── 生命周期 ──────────────────────────────────────────────────

onMounted(() => {
  loadTables()
  // 地图就绪后设置交互
  nextTick(() => setupMapInteractions())
})

// ── 地图交互 ──────────────────────────────────────────────────

function setupMapInteractions() {
  const m = map.value
  if (!m) {
    nextTick(() => setupMapInteractions())  // 地图尚未就绪，重试
    return
  }
  // 悬浮要素时切换指针样式
  m.on("pointermove", (e: any) => {
    const hit = m.hasFeatureAtPixel(e.pixel)
    m.getTargetElement().style.cursor = hit ? "pointer" : ""
  })
  // 点击要素 → 高亮对应表格行
  m.on("click", (e: any) => {
    const feature = m.forEachFeatureAtPixel(e.pixel, (f: any) => f)
    if (!feature) return
    const rowIndex = feature.get("_rowIndex")
    if (rowIndex === undefined || rowIndex < 0 || rowIndex >= tableRows.value.length) return
    const row = tableRows.value[rowIndex]
    // 高亮表格行并滚动到可视区域
    tableRef.value?.setCurrentRow(row)
    // 为什么需要 nextTick？ setCurrentRow(row) 后 Vue 需要一轮 DOM 更新才会把 current-row class 
    // 加到对应 <tr> 上。不加 nextTick 的话 .querySelector('.current-row') 返回 null。
    nextTick(() => {
      // 获取表格DOM元素的body包装器
      const wrapper = tableRef.value?.$el?.querySelector('.el-table__body-wrapper')
      if (wrapper) {
        // 在 tbody 区域找到带有 .current-row 类的行元素
        const rowEl = (wrapper as HTMLElement).querySelector('.current-row') as HTMLElement
        // 如果找到当前行元素，则平滑滚动到该行位置
        // block: 'nearest' 的意思是：如果该行已经在可视区域内就不动，在下方就滚到可见区底部，在上方就滚到顶部。
        if (rowEl) rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    })
    // 同时高亮地图要素
    onRowClick(row)
  })
}

// ── 加载表列表 ───────────────────────────────────────────────

async function loadTables() {
  try {
    const res = await getSpatialTables()
    allTables.value = res.data ?? []
    // 默认选中 capital，没有再选第一个
    const defaultTable = allTables.value.find(t => t.tableName === "capital")
    if (defaultTable) {
      onTableSelect(defaultTable.tableName)
    } else if (allTables.value.length > 0) {
      onTableSelect(allTables.value[0].tableName)
    }
  } catch {
    ElMessage.error("获取空间表列表失败")
  }
}

// ── 选择表 → 加载数据 ───────────────────────────────────────

function onTableSelect(tableName: string) {
  const t = allTables.value.find(x => x.tableName === tableName)
  if (!t) return
  activeTable.value = t
  currentPage.value = 1
  searchText.value = ""
  isSearching.value = false
  // 立即清除旧图层，不等 API 返回
  cleanupVectorLayer()
  cleanupInteractions()
  loadData()
}

async function loadData() {
  const t = activeTable.value
  if (!t) return
  try {
    const res = await getTableData(t.tableName, currentPage.value, pageSize.value)
    applyPageResult(res.data)
  } catch {
    ElMessage.error("获取数据失败")
  }
}

async function doSearch() {
  const t = activeTable.value
  if (!t || !searchText.value.trim()) {
    isSearching.value = false
    return loadData()
  }
  isSearching.value = true
  currentPage.value = 1
  try {
    const res = await searchTableData(t.tableName, searchText.value.trim(),
      currentPage.value, pageSize.value)
    applyPageResult(res.data)
  } catch {
    ElMessage.error("搜索失败")
  }
}

function refreshData() {
  cleanupInteractions()
  if (isSearching.value) doSearch()
  else loadData()
}

function applyPageResult(result: PageResultVO) {
  tableRows.value = result.rows ?? []
  displayFields.value = result.fields ?? []
  totalRows.value = result.total
  // 使用 nextTick 确保 DOM 更新完成后执行回调函数
  // 在 Vue 中，nextTick 用于在下次 DOM 更新循环结束之后执行延迟回调
  // 这里在地图相关 DOM 更新后，调用 loadFeaturesToMap 函数加载地图要素
  nextTick(() => loadFeaturesToMap()) 
}

// ── 地图要素加载（WKT 4326 → Feature 3857）─────────────────

function loadFeaturesToMap() {
  cleanupVectorLayer()
  const m = map.value
  if (!m || tableRows.value.length === 0) return

  const source = new VectorSource()
  const features = []

  for (const row of tableRows.value) {
    const wkt = row.wkt // xml中的 st_astext("${geomColumn}") AS wkt
    if (!wkt) continue
    try {
      // 数据库存储为 4326 → WKT 解析为 4326 → 地图显示为 3857
      const feature = wktFormat.readFeature(wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      })
      // 标记该要素对应的表格行索引
      // indexOf 是 JS 数组的原生方法，返回元素在数组中的位置（0-based）。
      feature.set("_rowIndex", tableRows.value.indexOf(row)) 
      features.push(feature)
    } catch (e) {
      console.warn("WKT 解析失败:", wkt, e)
    }
  }

  source.addFeatures(features)

  const layer = new VectorLayer({
    source,
    style: createStyleFunction(),
  })
  m.addLayer(layer) // 将图层添加到地图中
  vectorLayer.value = layer // 保存图层引用，便于后续操作

  if (features.length > 0) {
    const extent = source.getExtent()
    if (extent) m.getView().fit(extent, { padding: [50, 50, 50, 50], maxZoom: 16, duration: 500 })
  }
}

function cleanupVectorLayer() {
  if (!map.value) return
  const all = map.value.getLayers().getArray()
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i] instanceof VectorLayer) {
      map.value.removeLayer(all[i])
    }
  }
  vectorLayer.value = null
  tempDrawLayer.value = null
}

function createStyleFunction() {
  // 统一风格：fill 对多边形生效，image 对点生效，stroke 对线/多边形都生效
  return new Style({
    // 面样式 
    fill: new Fill({ color: "rgba(64, 158, 255, 0.15)" }),
    // 线样式
    stroke: new Stroke({ color: "#409eff", width: 2 }),
    // 点样式
    image: new CircleStyle({
      radius: 5, fill: new Fill({ color: "#409eff" }),
      stroke: new Stroke({ color: "#fff", width: 1.5 }),
    }),
  })
}

// ── Select：点击要素 → 表格选中行 ─────────────────────────

function onRowClick(row: Record<string, any>) {
  if (!map.value || !vectorLayer.value) return
  const source = vectorLayer.value.getSource()
  if (!source) return

  const rowIndex = tableRows.value.indexOf(row)
  source.forEachFeature((f) => {
    if (f.get("_rowIndex") === rowIndex) {
      f.setStyle(new Style({
        fill: new Fill({ color: "rgba(255, 255, 0, 0.35)" }),
        stroke: new Stroke({ color: "#ff6600", width: 3 }),
        image: new CircleStyle({
          radius: 8, fill: new Fill({ color: "#ff6600" }),
          stroke: new Stroke({ color: "#fff", width: 2 })
        }),
      }))
    } else {
      f.setStyle(undefined)
    }
  })
}

// 暂时没用到，涉及到多选功能
function onSelectionChange(selection: Record<string, any>[]) {
  selectedRows.value = selection
}

// ── 添加流程：先绘制，再弹窗 ───────────────────────────────

function startAddDraw() {
  if (!map.value || !activeTable.value) {
    ElMessage.warning("请先选择一个空间表")
    return
  }

  isDrawing.value = true
  cleanupInteractions()  // 只清交互，不清图层

  const geomType = activeTable.value.geometryType
  const olType = mapDrawType(geomType)
  const source = new VectorSource()
  const layer = new VectorLayer({ source, style: createStyleFunction() })
  map.value.addLayer(layer)
  tempDrawLayer.value = layer  // 临时绘制图层，不覆盖 vectorLayer

  const draw = new Draw({ source, type: olType })
  map.value.addInteraction(draw) // 添加绘制交互
  drawInteraction = draw // 保存引用，便于后续移除

  draw.on("drawend", (e) => {
    isDrawing.value = false
    map.value!.removeInteraction(draw)
    drawInteraction = null

    const geom4326 = e.feature.getGeometry()!.clone().transform("EPSG:3857", "EPSG:4326")
    pendingWkt.value = wktFormat.writeGeometry(geom4326)

    isAdd.value = true
    editingRow.value = null // 新建要素没有原始行数据
    editForm.value = {} // 清空表单
    editDialogVisible.value = true
  })
}

// ── 编辑流程：弹窗 + Modify 交互 ──────────────────────────

function onEdit(row: Record<string, any>) {
  isAdd.value = false // 编辑模式
  editingRow.value = row
  editForm.value = {}
  for (const f of formFields.value) {
    editForm.value[f.name] = row[f.name]
  }
  pendingWkt.value = row.wkt ?? ""
  editDialogVisible.value = true
  // 几何编辑请点击该行的「几何」按钮 → 地图上拖拽 → 确认/取消
}

/** 快速编辑几何 — 点击后激活 Modify，拖拽修改，手动确认/取消 */
function onEditGeom(row: Record<string, any>) {
  if (!map.value || !vectorLayer.value) {
    ElMessage.warning("地图尚未就绪")
    return
  }
  isEditingGeom.value = true
  editingRow.value = row
  pendingWkt.value = row.wkt ?? ""

  // 高亮该要素
  onRowClick(row)

  // 激活 Modify，只允许编辑目标要素
  cleanupInteractions()
  const rowIndex = tableRows.value.indexOf(row)
  const modify = new Modify({
    source: vectorLayer.value.getSource()!,
    filter: (f) => f.get("_rowIndex") === rowIndex,
  })
  map.value.addInteraction(modify)
  modifyInteraction = modify
  ElMessage.info("请在地图上拖拽修改几何，修改完成后点击「确认」保存")
}

function confirmGeomEdit() {
  if (!map.value || !editingRow.value) return
  const t = activeTable.value
  if (!t) return
  const source = vectorLayer.value?.getSource()
  if (!source) return
  // 从地图要素上取拖拽后的最新几何，不依赖 pendingWkt
  const rowIndex = tableRows.value.indexOf(editingRow.value)
  let newWkt: string | null = null
  source.forEachFeature((f) => {
    if (f.get("_rowIndex") === rowIndex) {
      const geom4326 = f.getGeometry()!.clone().transform("EPSG:3857", "EPSG:4326")
      newWkt = wktFormat.writeGeometry(geom4326)
    }
  })
  if (!newWkt) { ElMessage.warning("无几何数据"); return }
  updateTableRow(t.tableName, {
    geomColumn: t.geomColumn,
    rowKeyColumn: t.rowKeyColumn,
    rowKeyValue: editingRow.value[t.rowKeyColumn],
    newRow: {},
    fields: [],
    wkt: newWkt,
  }).then(() => {
    ElMessage.success("几何已更新")
    isEditingGeom.value = false // 关闭几何编辑状态，隐藏工具栏
    cleanupInteractions()
    refreshData()
  }).catch((e: any) => {
    ElMessage.error(e?.message || "更新失败")
  })
}

function cancelGeomEdit() {
  isEditingGeom.value = false // 关闭几何编辑状态，隐藏工具栏
  cleanupInteractions()
  refreshData()  // 重新加载原始几何
  ElMessage.info("已取消编辑")
}

function removeTempDrawLayer() {
  if (!tempDrawLayer.value) return
  // clear()清空绘制的要素，但其实不需要，下方赋值null后会被垃圾回收
  tempDrawLayer.value.getSource()?.clear()      
  if (map.value) {
    map.value.removeLayer(tempDrawLayer.value as any)  // 移除图层
  }
  tempDrawLayer.value = null
}

function onEditClose() {
  cleanupInteractions()
  if (isAdd.value) {
    removeTempDrawLayer()
  }
  isAdd.value = false
  isDrawing.value = false
  editingRow.value = null
  pendingWkt.value = ""
}

function cancelDraw() {
  cleanupInteractions()
  removeTempDrawLayer()  // 移除临时绘制图层，保留原有业务图层
  isDrawing.value = false
  isAdd.value = false
  pendingWkt.value = "" // 清空待提交的 WKT
  editDialogVisible.value = false
}

// 
function cleanupInteractions() {
  if (drawInteraction && map.value) { map.value.removeInteraction(drawInteraction); drawInteraction = null }
  if (modifyInteraction && map.value) { map.value.removeInteraction(modifyInteraction); modifyInteraction = null }
}

// ── 保存 ──────────────────────────────────────────────────────

async function saveEdit() {
  const t = activeTable.value
  if (!t) return

  const pkCol = t.rowKeyColumn
  const dto = {
    geomColumn: t.geomColumn, // 几何列名
    rowKeyColumn: pkCol, // 主键列名
    rowKeyValue: editingRow.value?.[pkCol] ?? null, // 主键具体值，新增时为 null，编辑时为原始值
    newRow: { ...editForm.value }, // 复制表单数据
    fields: saveFields.value, // 只提交非几何、非主键字段
    wkt: pendingWkt.value || undefined, // 几何数据
  }

  try {
    if (isAdd.value) {
      await addTableRow(t.tableName, dto)
      ElMessage.success("添加成功")
    } else {
      await updateTableRow(t.tableName, dto)
      ElMessage.success("保存成功")
    }
    editDialogVisible.value = false
    refreshData()
  } catch (e: any) {
    ElMessage.error(e?.message || "保存失败")
  }
}

// ── 删除 ──────────────────────────────────────────────────────

async function onDelete(row: Record<string, any>) {
  const t = activeTable.value
  if (!t) return

  try {
    await ElMessageBox.confirm("此操作将永久删除该数据, 是否继续?", "提示", {
      confirmButtonText: "确定", cancelButtonText: "取消", type: "warning",
    })
  } catch { return }

  try {
    const pkCol = t.rowKeyColumn
    await deleteTableRow(t.tableName, {
      geomColumn: t.geomColumn,
      rowKeyColumn: pkCol,
      rowKeyValue: row[pkCol],
      newRow: {},
      fields: [],
    })
    ElMessage.success("删除成功")
    refreshData()
  } catch (e: any) {
    ElMessage.error(e?.message || "删除失败")
  }
}

// ── 工具函数 ────────────────────────────────────────────────

function shortType(geomType: string | null | undefined): string {
  if (!geomType) return "?"
  const u = geomType.toUpperCase()
  if (u.includes("POINT")) return "点"
  if (u.includes("LINE")) return "线"
  if (u.includes("POLYGON") || u.includes("AREA")) return "面"
  return "?"
}

function typeTag(geomType: string | null | undefined): "success" | "warning" | "info" | "danger" {
  if (!geomType) return "info"
  const u = geomType.toUpperCase()
  if (u.includes("POINT")) return "danger"
  if (u.includes("LINE")) return "warning"
  if (u.includes("POLYGON") || u.includes("AREA")) return "success"
  return "info"
}

function mapDrawType(geomType: string | null | undefined): "Point" | "LineString" | "Polygon" {
  const u = (geomType ?? "").toUpperCase()
  if (u.includes("POINT")) return "Point"
  if (u.includes("LINE")) return "LineString"
  if (u.includes("POLYGON") || u.includes("AREA")) return "Polygon"
  return "Point"
}
</script>

<style scoped lang="scss">
.spatial-editor {
  position: relative;
  display: flex;
  height: calc(100vh - 100px);
  overflow: hidden;
}

.table-panel {
  width: 240px;
  flex-shrink: 0;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 600;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.panel-search {
  padding: 8px 12px;
}

.panel-scroll {
  flex: 1;
}

.table-name {
  margin-left: 6px;
  font-size: 13px;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.map-container {
  position: relative;
  flex: 1;
  min-height: 300px;
}

.map-controls-right {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bottom-bar {
  border-top: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  padding: 6px 12px 8px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.total-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: auto;
}

.geom-edit-area {
  padding: 8px;
  border: 1px dashed var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
}

/* 几何编辑浮动工具栏 */
.geom-edit-toolbar {
  position: absolute;
  top: 12px;
  left: 400px;
  transform: translateX(-50%);
  z-index: 10;
  background: var(--el-bg-color-overlay);
  padding: 10px 16px;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
