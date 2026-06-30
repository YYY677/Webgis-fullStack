<template>
  <div class="layer-control">
    <!-- 触发按钮 -->
    <el-tooltip content="图层控制" placement="left">
      <el-button class="trigger-btn" :icon="MapLocation" circle @click="open = !open" />
    </el-tooltip>

    <!-- 下拉面板 -->
    <Transition name="fade">
      <div v-if="open" class="layer-panel">
        <div class="panel-header">图层控制</div>

        <div v-if="layers.length === 0" class="empty-tip">暂无业务图层</div>

        <div v-for="item in layers" :key="item.id" class="layer-row">
          <!-- 可见性切换 -->
          <!-- 当 hiddenIds 这个数据结构中包含（存在）当前项的 item.id 时，
          元素就会被加上 off 类名；反之，则不会添加该类名。 -->
          <el-icon class="visibility-icon" :class="{ off: hiddenIds.has(item.id) }" @click="toggleLayer(item)">
            <View v-if="!hiddenIds.has(item.id)" />
            <Hide v-else />
          </el-icon>

          <span class="layer-name">{{ item.name }}</span>

          <el-button size="small" text type="primary" @click="openAttrTable(item)">
            属性表
          </el-button>
        </div>
      </div>
    </Transition>

    <!-- 属性表弹窗 -->
    <el-dialog v-model="attrDialogVisible" :title="`${currentLayer?.name} — 属性表`" width="80%" top="5vh"
      destroy-on-close>
      <!-- 搜索栏 -->
      <div class="attr-toolbar">
        <!-- clearable 表示输入框右侧会出现一个“清空”图标，点击后可一键清空已输入的内容。 -->
        <el-input v-model="searchText" placeholder="搜索（全字段模糊匹配）" clearable :prefix-icon="Search" size="default"
          style="width: 280px" />
        <span class="attr-summary">共 {{ filteredRows.length }} 条</span>
      </div>

      <!-- 表格 -->
      <el-table :data="pagedRows" border stripe max-height="60vh" style="width: 100%">
        <el-table-column type="index" label="#" width="55" fixed />
        <!--
            sortable 让 el-table 自动显示排序箭头（点击可升/降序），
            但 el-table 默认排序只比较字符串，数字排序会出错（"2" > "100"）。
            sort-method 覆盖默认比较逻辑，由 compareValues 处理 null / 数字 / 字符串。
            a / b 是 el-table 传入的整行数据（不是列的值），
            所以要用 a.props[col] 取当前列的值来比较。

            假设 col = "name"
            prop="props.name"
            等价于 el-table 从 row 取： row["props"]["name"]
            也就是： { props: { name: "北京", id: 0, ... } }.props.name → "北京"
        -->

        <el-table-column v-for="col in attrColumns" :key="col" :prop="`props.${col}`" :label="col" show-overflow-tooltip
          sortable :sort-method="(a: any, b: any) => compareValues(a.props[col], b.props[col])" />
        <!-- 操作列：定位按钮 -->
        <el-table-column label="操作" width="70" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="定位到此要素" placement="top">
              <el-button size="small" text :icon="Aim" @click="locateFeature(row)" />
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="attr-pagination">
        <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize" :page-sizes="[20, 50, 100, 200]"
          :total="filteredRows.length" layout="total, sizes, prev, pager, next, jumper" background small />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * LayerControl — 图层控制组件
 *
 * 职责：
 *  1. 列出所有业务图层，支持切换可见性
 *  2. 属性表：分页展示 + 全字段模糊搜索 + 定位要素（缩放+闪烁）
 *
 * 用法：
 *   <LayerControl :map="map" :layers="layerInfos" />
 */
import { ref, reactive, computed } from "vue"
import { MapLocation, View, Hide, Aim, Search } from "@element-plus/icons-vue"
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style"
import type Map from "ol/Map"

// ── 类型 ──────────────────────────────────────────────────

export interface LayerInfo {
  id: string
  name: string
  layer: {
    setVisible(visible: boolean): void
    getVisible(): boolean
    getSource?(): any
  }
}

/** 表格行：属性值 + OL 要素引用，定位时直接从 row 取 feature 不用反查 */
interface AttrRow {
  props: Record<string, any> // Record<string, any>表示一个对象，其键为字符串类型，值可以是任意类型
  feature: any // OL Feature，any 避免跟 OL 内部类型死磕
}

// ── Props ──────────────────────────────────────────────────

const props = defineProps<{
  layers: LayerInfo[]
  map: Map | null
}>()

// ── 图层可见性 ─────────────────────────────────────────────

const open = ref(false)
const hiddenIds = reactive(new Set<string>())

function toggleLayer(item: LayerInfo) {
  if (hiddenIds.has(item.id)) {
    hiddenIds.delete(item.id)
    item.layer.setVisible(true)
  } else {
    hiddenIds.add(item.id)
    item.layer.setVisible(false)
  }
}

// ── 属性表状态 ─────────────────────────────────────────────

const attrDialogVisible = ref(false)
const currentLayer = ref<LayerInfo | null>(null)
const attrColumns = ref<string[]>([])
/** 全量行数据（含 feature 引用），搜索和分页都从这里切 */
const attrRows = ref<AttrRow[]>([])
const searchText = ref("")
const currentPage = ref(1)
const pageSize = ref(50)

// ── 搜索过滤 ───────────────────────────────────────────────

/** 全字段模糊匹配：输入即过滤，大小写不敏感 */
const filteredRows = computed(() => {
  const q = searchText.value.trim().toLowerCase()
  if (!q) return attrRows.value // 搜索为空时直接返回全量

  /**
   * 筛选属性行数据
   * 根据查询条件q过滤属性行，检查每行props中的值是否包含查询字符串
   * 返回包含查询字符串的属性行数组
   */
  return attrRows.value.filter((row) => {
    // 遍历当前行的所有props值
    // Object.values(obj) 把对象的值提出来变成一个数组：
    // Object.values({ name: "北京", id: 0, satisfacti: 95 })
    // 结果: ["北京", 0, 95]
    // some 的作用：遍历数组，只要有一个元素让回调返回 true，整体就返回 true。
    return Object.values(row.props).some((v) => {
      // 如果值是字符串，进行不区分大小写的包含检查
      if (typeof v === "string") return v.toLowerCase().includes(q)
      // 如果值是数字，将其转换为字符串后进行包含检查
      if (typeof v === "number") return String(v).includes(q)
      // 其他类型值不进行匹配
      return false
    })
  })
})

// ── 分页 ───────────────────────────────────────────────────

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

// 搜索文本变化时回到第一页
import { watch } from "vue"
watch(searchText, () => {
  currentPage.value = 1
})

// ── 打开属性表 ─────────────────────────────────────────────

/**
 * 打开属性表弹窗：从图层 source 读取全量要素，构建表格行数据。
 *
 * 为什么一次性加载全部而不是只读一页？
 *   - 搜索需要全量数据才能做过滤（filteredRows → pagedRows）
 *   - 静态 GeoJSON 数据量小（几十到几百条），内存完全扛得住
 *   - 真正限制"展示多少"的是 el-pagination + pagedRows computed，不是这里
 *
 * 如果是后端分页的 WFS 服务，这里应该改成传 page/pageSize 给接口。
 */
function openAttrTable(item: LayerInfo) {
  // 重置搜索和分页状态
  currentLayer.value = item
  searchText.value = ""
  currentPage.value = 1

  const source = item.layer.getSource?.()
  // ?? 表示如果 source 或 getFeatures 为 null/undefined，则返回空数组
  const features = source?.getFeatures?.() ?? []

  // Set 自动去重 — 多个 feature 共有的字段只存一次
  const keys = new Set<string>()
  const rows: AttrRow[] = []

  features.forEach((f: any) => {
    // getProperties() 返回要素身上所有 key-value，包括：
    //   - GeoJSON properties 里的业务字段（name、satisfacti 等）
    //   - OL 内部属性（geometry、feature.getGeometryName()）
    // 我们需要前者当表格列，后者要过滤掉
    const allProps = f.getProperties()
    const row: Record<string, any> = {}

    // Object.keys(allProps) 拿到所有属性名，逐个处理
    // 例如 ["geometry", "name", "id", "lat", "lon", ...]
    Object.keys(allProps).forEach((k) => {
      // 跳过 geometry 字段（OL 内部存的几何对象，不是业务数据）
      if (k !== "geometry" && k !== f.getGeometryName?.()) {
        keys.add(k)       // 收集列名（Set 自动去重）
        row[k] = allProps[k] // 填入该行的属性值
      }
    })
    rows.push({ props: row, feature: f })
  })

  // Set → Array，供 el-table-column 的 v-for 遍历
  attrColumns.value = Array.from(keys)
  attrRows.value = rows // 全量存入，分页由 pagedRows computed 切片
  attrDialogVisible.value = true
}

// ── 排序辅助 ───────────────────────────────────────────────

/**
 * 排序比较函数 — 给 el-table sort-method 用
 *
 * 返回值：
 *   < 0：a 排在 b 前面
 *   > 0：b 排在 a 前面
 *   0：相等
 * 
 * 假设 a=3, b=5
 * compareValues(3, 5) → 3 - 5 = -2 → 负数 → 3 排 5 前面（升序）
 * 假设 a=5, b=3
 * compareValues(5, 3) → 5 - 3 = 2  → 正数 → 3 排 5 前面（升序）
 * 假设 a=3, b=3
 * compareValues(3, 3) → 3 - 3 = 0  → 相等
 *
 * 处理三种情况：
 *   1. null 值排在末尾（不管升序降序）
 *   2. 数字类型做数值比较（避免 "2" > "100" 的字符串坑）
 *   3. 其他类型转成字符串做字典序比较（"上海" < "北京" 按拼音 Unicode 排）
 */
function compareValues(a: any, b: any): number {
  // 两个都是 null，视为相等
  if (a == null && b == null) return 0
  // a is null → a 排 b 后面（返回正数）
  if (a == null) return 1
  // b is null → b 排 a 后面（返回负数）
  if (b == null) return -1
  // 两个都是数字 → 做减法，实现纯数值排序
  if (typeof a === "number" && typeof b === "number") return a - b
  // 兜底：转字符串用 localeCompare 按语言环境排字符顺序
  return String(a).localeCompare(String(b))
}

// ── 定位要素 ───────────────────────────────────────────────

/** 闪烁高亮样式（通用：Point / LineString / Polygon 都适用） */
const flashStyle = new Style({
  fill: new Fill({ color: "rgba(255, 255, 0, 0.45)" }),
  stroke: new Stroke({ color: "#ff0000", width: 3 }),
  image: new CircleStyle({
    radius: 12,
    fill: new Fill({ color: "#ff0000" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
})

/**
 * 点击定位按钮 → 缩放地图到要素范围 + 短暂闪烁高亮
 * Point 要素手动放大 extent，避免 fit 到极限比例尺
 */
function locateFeature(row: AttrRow) {
  if (!props.map) return

  const geom = row.feature.getGeometry()
  if (!geom) return

  const geomType = geom.getType()
  let extent = geom.getExtent()

  // Point extent 是零面积的 [x, y, x, y]，fit 会直接缩到最大 level
  // 手动制造一个约 2km 见方的范围
  if (geomType === "Point") {
    const [x, y] = extent
    const delta = 0.02 // ~2.2km at equator in EPSG:3857
    extent = [x - delta, y - delta, x + delta, y + delta]
  }

  // 获取地图视图并调整视图以适应指定范围
  props.map.getView().fit(extent, {
    padding: [60, 60, 60, 60],  // 设置视图内边距，上下左右均为60像素
    duration: 600,              // 视图动画持续时间，单位为毫秒
    maxZoom: 16,                // 设置最大缩放级别为16
  })

  // 闪烁：设高亮 → 1.2s 后恢复图层默认样式
  row.feature.setStyle(flashStyle)
  setTimeout(() => {
    row.feature.setStyle(undefined)
  }, 1200)

  // 定位后关闭属性表，方便直接看地图
  attrDialogVisible.value = false
}
</script>

<style scoped>
.layer-control {
  position: absolute;
  top: 108px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.trigger-btn {
  font-size: 24px;
}

.layer-panel {
  position: absolute;
  right: 35px;
  background: var(--el-bg-color-overlay);
  backdrop-filter: blur(80px);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  min-width: 200px;
  box-shadow: var(--el-box-shadow-light);
}

.panel-header {
  font-size: 13px;
  color: var(--el-text-color-primary);
  padding: 10px 12px 6px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.empty-tip {
  padding: 16px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

/* ── 图层行 ─────────────────────────────────────────────── */
.layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.layer-row:last-child {
  border-bottom: none;
}

.visibility-icon {
  font-size: 16px;
  cursor: pointer;
  flex-shrink: 0;
  color: var(--el-color-primary);
  transition: color 0.15s;

  /*  */
  &.off {
    color: var(--el-text-color-placeholder);
  }

  &:hover {
    color: var(--el-color-primary-light-3);
  }
}

.layer-name {
  flex: 1;
  font-size: 13px;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 属性表工具栏 ───────────────────────────────────────── */
.attr-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.attr-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

/* ── 分页 ─────────────────────────────────────────────── */
.attr-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

/* ── Transition ─────────────────────────────────────────── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
