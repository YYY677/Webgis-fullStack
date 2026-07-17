<template>
  <div class="spatial-analysis">
    <!-- Tab 切换 -->
    <el-tabs v-model="activeTab" class="analysis-tabs" @tab-change="onTabChange">
      <el-tab-pane label="缓冲区" name="buffer" />
      <el-tab-pane label="叠加" name="intersection" />
      <el-tab-pane label="合并" name="union" />
      <el-tab-pane label="差异" name="difference" />
      <el-tab-pane label="对称差" name="symdifference" />
      <el-tab-pane label="空间关系" name="relation" />
      <el-tab-pane label="路径分析" name="path" />
    </el-tabs>

    <div class="analysis-body">
      <!-- 参数面板 -->
      <div class="param-panel">
        <!-- 缓冲区 -->
        <template v-if="activeTab === 'buffer'">
          <div class="param-section">
            <div class="param-label">输入几何</div>
            <el-button size="small" @click="startDraw(1)">在地图上绘制</el-button>
            <el-input v-model="geomInput1" type="textarea" :rows="3" placeholder="或粘贴 WKT" class="geom-input" />
          </div>
          <div class="param-section">
            <div class="param-label">缓冲区距离</div>
            <el-input-number v-model="bufferDistance" :min="0" :max="100" :step="0.1" />
            <span class="param-unit">度（约 {{ (bufferDistance * 111).toFixed(0) }} km）</span>
          </div>
        </template>

        <!-- 双几何输入（叠加/合并/差异/对称差/空间关系） -->
        <template v-if="isDualGeomTab">
          <div class="param-section">
            <div class="param-label">几何 1</div>
            <el-button size="small" @click="startDraw(1)">绘制</el-button>
            <el-input v-model="geomInput1" type="textarea" :rows="2" placeholder="或粘贴 WKT" class="geom-input" />
          </div>
          <div class="param-section">
            <div class="param-label">几何 2</div>
            <el-button size="small" @click="startDraw(2)">绘制</el-button>
            <el-input v-model="geomInput2" type="textarea" :rows="2" placeholder="或粘贴 WKT" class="geom-input" />
          </div>
        </template>

        <!-- 路径分析 -->
        <template v-if="activeTab === 'path'">
          <div class="param-section">
            <div class="param-label">起点</div>
            <el-button size="small" type="success" @click="startPathPick('start')">
              {{ pathPicking === 'start' ? '点击地图选点...' : '设置起点' }}
            </el-button>
            <el-tag v-if="pathStart" type="success" class="coord-tag">{{ fmtCoord(pathStart) }}</el-tag>
          </div>
          <div class="param-section">
            <div class="param-label">终点</div>
            <el-button size="small" type="warning" @click="startPathPick('end')">
              {{ pathPicking === 'end' ? '点击地图选点...' : '设置终点' }}
            </el-button>
            <el-tag v-if="pathEnd" type="warning" class="coord-tag">{{ fmtCoord(pathEnd) }}</el-tag>
          </div>
        </template>

        <el-button type="primary" class="submit-btn" @click="doAnalysis">
          {{ activeTab === 'path' ? '导航' : '提交分析' }}
        </el-button>
      </div>

      <!-- 地图 -->
      <div class="map-area">
        <div id="analysis-map" class="map-container">
          <div class="map-controls-right">
            <BasemapSwitcher :set-base-layer="setBaseLayer" />
            <BasicToolBox v-if="map" :map="map" />
            <MapSetting v-if="map" :map="map" />
          </div>
        </div>
      </div>
    </div>

    <!-- 结果面板 -->
    <div v-if="showResult" class="result-panel">
      <div class="result-title">分析结果</div>

      <!-- WKT 结果 -->
      <template v-if="activeTab !== 'relation' && activeTab !== 'path'">
        <el-input v-model="resultWkt" type="textarea" :rows="2" readonly class="result-wkt" />
      </template>

      <!-- 空间关系结果 -->
      <div v-if="activeTab === 'relation' && relationDesc" class="relation-desc">
        <el-alert :title="relationDesc" type="info" :closable="false" show-icon />
      </div>
      <el-table v-if="activeTab === 'relation'" :data="relationRows" border size="small" style="margin-top: 6px">
        <el-table-column prop="name" label="关系" width="100" />
        <el-table-column prop="value" label="结果" width="70">
          <template #default="{ row }">
            <el-tag :type="row.value ? 'success' : 'danger'" size="small">{{ row.value }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="desc" label="说明" />
      </el-table>

      <!-- 路径结果 -->
      <div v-if="activeTab === 'path' && resultPathCost" class="path-result">
        路径总长度：<strong>{{ resultPathCost }}</strong> 度
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 06-spatial-analysis — 空间分析
 *
 * 7 种分析类型：缓冲区、叠加、合并、差异、对称差、空间关系、路径分析
 * 几何输入支持地图绘制和 WKT 粘贴
 */
import { ref, computed, onMounted } from "vue"
import { ElMessage } from "element-plus"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue"
import MapSetting from "@/components/MapSetting.vue"

import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import TileLayer from "ol/layer/Tile"
import TileWMS from "ol/source/TileWMS"
import WKT from "ol/format/WKT"
import Draw from "ol/interaction/Draw"
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style"
import Feature from "ol/Feature"
import Point from "ol/geom/Point"
import { transform } from "ol/proj"

import {
  bufferAnalysis, intersectionAnalysis, unionAnalysis,
  differenceAnalysis, symdiffAnalysis, relationAnalysis, shortestPath,
} from "@/api/spatial-analysis"

// ── 地图 ──────────────────────────────────────────────────────

const { map, setBaseLayer } = useMap("analysis-map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 },
})

// ── Tab ───────────────────────────────────────────────────────

const activeTab = ref("buffer")

const isDualGeomTab = computed(() =>
  ["intersection", "union", "difference", "symdifference", "relation"].includes(activeTab.value))

// ── 输入 ──────────────────────────────────────────────────────

const geomInput1 = ref("")
const geomInput2 = ref("")
const bufferDistance = ref(0.5)

// 路径分析
const pathStart = ref<[number, number] | null>(null)
const pathEnd = ref<[number, number] | null>(null)

// 结果
const resultWkt = ref("")
const resultRelations = ref<Record<string, boolean>>({})
const resultPathCost = ref(0)
const showResult = ref(false)

const relationLabels: Record<string, string> = {
  equals: "相等", disjoint: "脱节", intersects: "相交",
  touches: "接触", crosses: "交叉", within: "内含", contains: "包含", overlaps: "重叠",
}
const relationDescs: Record<string, [string, string]> = {
  equals: ["两个几何的形状和位置完全相同", "两个几何不完全相同"],
  disjoint: ["两个几何没有共同点", "两个几何有共同点"],
  intersects: ["两个几何有共同点", "两个几何没有共同点"],
  touches: ["两个几何仅在边界处接触", "两个几何不仅边界接触"],
  crosses: ["两个几何交叉穿过", "两个几何不交叉"],
  within: ["几何1完全在几何2内部", "几何1不完全在几何2内部"],
  contains: ["几何1完全包含几何2", "几何1不完全包含几何2"],
  overlaps: ["两个几何部分重叠且有共同内部", "两个几何不重叠"],
}
const relationRows = computed(() =>
  Object.entries(resultRelations.value).map(([name, value]) => ({
    name: relationLabels[name] || name,
    value,
    desc: value ? relationDescs[name]?.[0] ?? "" : relationDescs[name]?.[1] ?? "",
  })))
const relationDesc = computed(() => {
  const r = resultRelations.value
  if (!r.intersects) return "两个几何不相交，没有共同部分"
  if (r.within) return "几何1完全在几何2内部"
  if (r.contains) return "几何1完全包含几何2"
  if (r.equals) return "两个几何完全相等"
  if (r.touches) return "两个几何仅在边界处接触"
  if (r.overlaps) return "两个几何部分重叠"
  if (r.crosses) return "两个几何交叉"
  if (r.touches) return "两个几何仅边界接触"
  return "两个几何相交"
})

// OL
const inputLayer = ref<VectorLayer<VectorSource> | null>(null)
const resultLayer = ref<VectorLayer<VectorSource> | null>(null)
const markerLayer = ref<VectorLayer<VectorSource> | null>(null)
const roadLayer = ref<TileLayer<TileWMS> | null>(null)
const wktFormat = new WKT()
let drawInteraction: Draw | null = null

// 路径选点
const pathPicking = ref<"start" | "end" | null>(null)
let pathClickHandler: ((e: any) => void) | null = null

// ── 工具函数 ──────────────────────────────────────────────────

function fmtCoord(c: [number, number] | null): string {
  if (!c) return ""
  const lonlat = c[0].toFixed(4) + ", " + c[1].toFixed(4)
  return lonlat
}

// ── 绘制输入几何 ──────────────────────────────────────────────

function startDraw(geomIndex: 1 | 2) {
  if (!map.value) return
  cleanupDraw()
  if (!inputLayer.value) {
    const source = new VectorSource()
    const layer = new VectorLayer({ source, style: inputStyle })
    layer.set("_analysisType", "input")
    map.value.addLayer(layer)
    inputLayer.value = layer
  }

  const draw = new Draw({
    source: inputLayer.value.getSource()!,
    type: "Polygon",
  })
  map.value.addInteraction(draw)
  drawInteraction = draw

  draw.on("drawend", (e) => {
    const geom4326 = e.feature.getGeometry()!.clone().transform("EPSG:3857", "EPSG:4326")
    const wkt = wktFormat.writeGeometry(geom4326)
    if (geomIndex === 1) geomInput1.value = wkt
    else geomInput2.value = wkt
    map.value!.removeInteraction(draw)
    drawInteraction = null
  })
}

function cleanupDraw() {
  if (drawInteraction && map.value) {
    map.value.removeInteraction(drawInteraction)
    drawInteraction = null
  }
}

// ── 路径选点 ──────────────────────────────────────────────────

function startPathPick(type: "start" | "end") {
  if (!map.value) return
  // 清除旧标记
  if (type === "start") {
    pathStart.value = null
    removeMarkersByColor("#67c23a")
  } else {
    pathEnd.value = null
    removeMarkersByColor("#e6a23c")
  }
  pathPicking.value = type
  if (!pathClickHandler) {
    pathClickHandler = (e: any) => {
      if (!pathPicking.value) return
      const picking = pathPicking.value
      pathPicking.value = null  // 立即清除，避免重复触发
      const coord: [number, number] = e.coordinate
      if (picking === "start") {
        pathStart.value = coord
        addMarker(coord, "#67c23a")
        ElMessage.success("起点已选，点击「设置终点」选择终点")
      } else {
        pathEnd.value = coord
        addMarker(coord, "#e6a23c")
        ElMessage.success("终点已选，点击「导航」计算路径")
      }
    }
    map.value.on("click", pathClickHandler)
  }
  ElMessage.info(`请在地图上点击${type === 'start' ? '起点' : '终点'}`)
}

function removeMarkersByColor(color: string) {
  if (!markerLayer.value) return
  const source = markerLayer.value.getSource()
  if (!source) return
  const toRemove = source.getFeatures().filter((f) => f.get("color") === color)
  toRemove.forEach((f) => source.removeFeature(f))
}

// ── 标记点（路径分析） ───────────────────────────────────────

function addMarker(coord3857: [number, number], color: string) {
  if (!map.value) return
  if (!markerLayer.value) {
    const source = new VectorSource()
    const layer = new VectorLayer({
      source,
      style: (feat) => {
        const c = feat.get("color") || "#409eff"
        return new Style({
          image: new CircleStyle({
            radius: 8, fill: new Fill({ color: c }),
            stroke: new Stroke({ color: "#fff", width: 2 }),
          }),
        })
      },
    })
    layer.set("_analysisType", "marker")
    map.value.addLayer(layer)
    markerLayer.value = layer
  }
  const feature = new Feature({ geometry: new Point(coord3857) })
  feature.set("color", color)
  markerLayer.value.getSource()!.addFeature(feature)
}

// ── 提交分析 ─────────────────────────────────────────────────

async function doAnalysis() {
  cleanupDraw()
  if (!map.value) return

  showResult.value = false

  try {
    switch (activeTab.value) {
      case "buffer": {
        if (!geomInput1.value) { ElMessage.warning("请输入几何"); return }
        const res = await bufferAnalysis(geomInput1.value, bufferDistance.value)
        resultWkt.value = res.data ?? ""
        drawResult([geomInput1.value, resultWkt.value])
        break
      }
      case "intersection": {
        if (!geomInput1.value || !geomInput2.value) { ElMessage.warning("请输入两个几何"); return }
        const res = await intersectionAnalysis(geomInput1.value, geomInput2.value)
        resultWkt.value = res.data ?? ""
        drawResult([geomInput1.value, geomInput2.value, resultWkt.value])
        break
      }
      case "union": {
        if (!geomInput1.value || !geomInput2.value) { ElMessage.warning("请输入两个几何"); return }
        const res = await unionAnalysis(geomInput1.value, geomInput2.value)
        resultWkt.value = res.data ?? ""
        drawResult([geomInput1.value, geomInput2.value, resultWkt.value])
        break
      }
      case "difference": {
        if (!geomInput1.value || !geomInput2.value) { ElMessage.warning("请输入两个几何"); return }
        const res = await differenceAnalysis(geomInput1.value, geomInput2.value)
        resultWkt.value = res.data ?? ""
        drawResult([geomInput1.value, geomInput2.value, resultWkt.value])
        break
      }
      case "symdifference": {
        if (!geomInput1.value || !geomInput2.value) { ElMessage.warning("请输入两个几何"); return }
        const res = await symdiffAnalysis(geomInput1.value, geomInput2.value)
        resultWkt.value = res.data ?? ""
        drawResult([geomInput1.value, geomInput2.value, resultWkt.value])
        break
      }
      case "relation": {
        if (!geomInput1.value || !geomInput2.value) { ElMessage.warning("请输入两个几何"); return }
        const res = await relationAnalysis(geomInput1.value, geomInput2.value)
        resultRelations.value = (res.data ?? {}) as Record<string, boolean>
        // 空间关系只显示输入几何，不高亮结果
        drawResult([geomInput1.value, geomInput2.value], "normal", -1)
        break
      }
      case "path": {
        if (!pathStart.value || !pathEnd.value) { ElMessage.warning("请先在地图上选择起点和终点"); return }
        // 地图坐标是 3857，后端需要 4326
        const s = transform(pathStart.value, "EPSG:3857", "EPSG:4326")
        const e = transform(pathEnd.value, "EPSG:3857", "EPSG:4326")
        const res = await shortestPath(
          parseFloat(s[0].toFixed(6)), parseFloat(s[1].toFixed(6)),
          parseFloat(e[0].toFixed(6)), parseFloat(e[1].toFixed(6)))
        const data = res.data as any
        resultWkt.value = data.wkt ?? ""
        resultPathCost.value = data.totalCost ?? 0
        drawResult([resultWkt.value], "path")
        break
      }
    }
    showResult.value = true
  } catch (e: any) {
    ElMessage.error(e?.message || "分析失败")
  }
}

// ── 在地图上绘制结果 ─────────────────────────────────────────

/** 在地图上显示分析结果。
 *  @param wkts WKT 数组，最后一个是结果几何（红色高亮）
 *  @param mode 'normal' | 'path'
 *  @param resultIndex 指定哪个是结果（默认最后一个，-1 表示没有结果几何）
 */
function drawResult(wkts: string[], mode: "normal" | "path" = "normal", resultIndex = -1) {
  cleanupResultLayer()
  if (!map.value) return

  const source = new VectorSource()
  const features = wkts.filter(Boolean).map((wkt, i) => {
    if (!wkt) return null
    try {
      const feat = wktFormat.readFeature(wkt, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      })
      feat.set("_index", i)
      return feat
    } catch { return null }
  }).filter(Boolean) as Feature[]

  source.addFeatures(features)

  let style: Style | ((f: any) => Style)
  if (mode === "path") {
    style = new Style({
      stroke: new Stroke({ color: "#ff6600", width: 5 }),
    })
  } else {
    const ri = resultIndex >= 0 ? resultIndex : wkts.length - 1
    style = (f: any) => {
      const idx = f.get("_index")
      if (ri >= 0 && idx === ri) {
        // 结果几何：红色半透明
        return new Style({
          fill: new Fill({ color: "rgba(255, 0, 0, 0.35)" }),
          stroke: new Stroke({ color: "#ff0000", width: 3 }),
          image: new CircleStyle({ radius: 6, fill: new Fill({ color: "#ff0000" }),
            stroke: new Stroke({ color: "#fff", width: 2 }) }),
        })
      }
      // 输入几何：蓝色细线
      return new Style({
        fill: new Fill({ color: "rgba(64, 158, 255, 0.1)" }),
        stroke: new Stroke({ color: "#409eff", width: 2, lineDash: [4, 4] }),
        image: new CircleStyle({ radius: 5, fill: new Fill({ color: "#409eff" }),
          stroke: new Stroke({ color: "#fff", width: 1.5 }) }),
      })
    }
  }

  const layer = new VectorLayer({ source, style })
  layer.set("_analysisType", "result")
  map.value.addLayer(layer)
  resultLayer.value = layer

  if (features.length > 0) {
    const extent = source.getExtent()
    if (extent) map.value.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 500 })
  }
}

function cleanupResultLayer() {
  if (!map.value) return
  const all = map.value.getLayers().getArray()
  for (let i = all.length - 1; i >= 0; i--) {
    const l = all[i] as any
    if (l.get?.("_analysisType") === "result" || l.get?.("_analysisType") === "marker") {
      map.value.removeLayer(l)
    }
  }
  resultLayer.value = null
  markerLayer.value = null
}

function cleanupRoadLayer() {
  if (roadLayer.value && map.value) {
    map.value.removeLayer(roadLayer.value as any)
    roadLayer.value = null
  }
}

function loadRoadLayer() {
  if (!map.value || roadLayer.value) return
  const layer = new TileLayer({
    source: new TileWMS({
      url: "/geoserver/wms",
      params: { LAYERS: "webgistest:shenzhen_roads", TILED: true, FORMAT: "image/png" },
      serverType: "geoserver",
    }),
  })
  map.value.addLayer(layer)
  roadLayer.value = layer
}

// ── Tab 切换 ──────────────────────────────────────────────────

function onTabChange() {
  // 重置结果状态（保留输入几何）
  showResult.value = false
  resultWkt.value = ""
  resultRelations.value = {}
  resultPathCost.value = 0
  pathStart.value = null
  pathEnd.value = null
  pathPicking.value = null
  // 清理交互和结果图层（保留输入几何）
  cleanupDraw()
  cleanupResultLayer()
  cleanupRoadLayer()
  // 路径 tab 加载路网底图 + 跳转深圳
  if (activeTab.value === "path") {
    loadRoadLayer()
    if (map.value) {
      map.value.getView().animate({
        center: [12700000, 2580000],
        zoom: 11,
        duration: 500,
      })
    }
  }
}

// ── 样式 ──────────────────────────────────────────────────────

const inputStyle = new Style({
  fill: new Fill({ color: "rgba(64, 158, 255, 0.15)" }),
  stroke: new Stroke({ color: "#409eff", width: 2 }),
  image: new CircleStyle({ radius: 5, fill: new Fill({ color: "#409eff" }),
    stroke: new Stroke({ color: "#fff", width: 1.5 }) }),
})
</script>

<style scoped lang="scss">
.spatial-analysis {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);

  .analysis-tabs {
    padding: 0 12px;
    flex-shrink: 0;
  }

  .analysis-body {
    flex: 1;
    display: flex;
    min-height: 0;

    .param-panel {
      width: 320px;
      flex-shrink: 0;
      padding: 12px;
      border-right: 1px solid var(--el-border-color-light);
      overflow-y: auto;

      .param-section {
        margin-bottom: 16px;

        .param-label {
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 6px;
          color: var(--el-text-color-primary);
        }

        .geom-input {
          margin-top: 6px;
        }

        .param-unit {
          font-size: 12px;
          color: var(--el-text-color-secondary);
          margin-left: 8px;
        }
      }

      .submit-btn {
        width: 100%;
        margin-top: 8px;
      }
    }

    .map-area {
      flex: 1;
      position: relative;

      .map-container {
        width: 100%;
        height: 100%;
      }
    }
  }

  .result-panel {
    flex-shrink: 0;
    border-top: 1px solid var(--el-border-color-light);
    padding: 8px 12px;
    background: var(--el-bg-color);

    .result-title {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .result-wkt {
      font-family: monospace;
      font-size: 12px;
    }

    .path-result {
      font-size: 14px;
    }
  }

  .coord-tag {
    margin-left: 6px;
    font-family: monospace;
  }

  .relation-desc {
    margin-bottom: 6px;
  }
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
</style>
