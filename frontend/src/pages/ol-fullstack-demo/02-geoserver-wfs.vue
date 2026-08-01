<template>
  <div id="map" class="map-container">
    <SearchBox v-if="map" :map="map" />

    <!-- WFS 操作工具栏 -->
    <div class="wfs-toolbar">
      <el-button-group>
        <el-button :type="mode === 'insert' ? 'primary' : ''" @click="insertClick">
          <el-icon><Plus /></el-icon>新增
        </el-button>
        <el-button :type="mode === 'update' ? 'primary' : ''" @click="updateClick">
          <el-icon><Edit /></el-icon>修改
        </el-button>
        <el-button :type="mode === 'delete' ? 'primary' : ''" @click="deleteClick">
          <el-icon><Delete /></el-icon>删除
        </el-button>
        <el-button @click="finishClick">完成</el-button>
      </el-button-group>
      <el-button @click="findData">
        <el-icon><Search /></el-icon>查询
      </el-button>
      <span class="mode-hint" v-if="mode === 'insert'">点击地图添加点位</span>
      <span class="mode-hint" v-else-if="mode === 'update'">点击要素后拖拽修改</span>
      <span class="mode-hint" v-else-if="mode === 'delete'">点击要素删除</span>
    </div>

    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue"
import { Plus, Edit, Delete, Search } from "@element-plus/icons-vue"
import { ElMessageBox, ElMessage } from "element-plus"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue"
import LayerControl from "@/components/LayerControl.vue"
import MapSetting from "@/components/MapSetting.vue"
import SearchBox from "@/components/SearchBox.vue"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import GeoJSON from "ol/format/GeoJSON"
import WFSFormat from "ol/format/WFS"
import { and, like, equalTo } from "ol/format/filter"
import { bbox as bboxStrategy } from "ol/loadingstrategy"
import Draw from "ol/interaction/Draw"
import Select from "ol/interaction/Select"
import Modify from "ol/interaction/Modify"
import { Style, Fill, Stroke, Circle as CircleStyle } from "ol/style"
import type Map from "ol/Map"
import type { LayerInfo } from "@/components/LayerControl.vue"

// ── 地图初始化 ────────────────────────────────────────────
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5, maxZoom: 20, minZoom: 2 }
})

const layerInfos: LayerInfo[] = []

// ── 常量 ──────────────────────────────────────────────────
const GEOSERVER_WFS = "/geoserver/wfs"
const WS_NAME = "webgistest"
const LAYER_NAME = "port"
const SRS_NAME = "EPSG:3857"
// GeoServer 工作空间 webgistest 的命名空间 URI
// 访问 http://localhost:8081/geoserver/rest/workspaces/webgistest.json 可查
const FEATURE_NS = "http://www.openplans.org/webgistest"

// ── 样式 ──────────────────────────────────────────────────
const defaultStyle = new Style({
  stroke: new Stroke({ color: "#3388ff", width: 1.5 }),
  fill: new Fill({ color: "rgba(51, 136, 255, 0.15)" }),
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "#3388ff" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
})

const selectStyle = new Style({
  stroke: new Stroke({ color: "#e74c3c", width: 2.5 }),
  fill: new Fill({ color: "rgba(231, 76, 60, 0.2)" }),
  image: new CircleStyle({
    radius: 8,
    fill: new Fill({ color: "#e74c3c" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
})

// ── 模式状态 ──────────────────────────────────────────────
const mode = ref<"" | "insert" | "update" | "delete">("")
let wfsLayer: VectorLayer | null = null
let activeInteractions: any[] = []
let tempLayers: any[] = []

// ── WFS 图层加载（bbox 策略） ────────────────────────────
function loadWfsLayer(m: Map) {
  const source = new VectorSource({
    format: new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    }),
    url: (extent: any) => {
      return `${GEOSERVER_WFS}?service=WFS&version=1.1.0&request=GetFeature`
        + `&typeName=${WS_NAME}:${LAYER_NAME}`
        + `&outputFormat=application/json`
        + `&srsname=${SRS_NAME}`
        + `&bbox=${extent.join(",")},${SRS_NAME}`
    },
    strategy: bboxStrategy,
  })

  wfsLayer = new VectorLayer({ source, style: defaultStyle })
  m.addLayer(wfsLayer)
  layerInfos.push({ id: "wfs-port", name: "港口分布", type: "vector", layer: wfsLayer })
}

// ── 交互管理 ──────────────────────────────────────────────

/** 清理 interactions + 临时图层 */
function cleanupAll() {
  const m = map.value
  if (!m) return
  activeInteractions.forEach((interaction) => m.removeInteraction(interaction))
  activeInteractions = []
  tempLayers.forEach((layer) => m.removeLayer(layer))
  tempLayers = []
}

function insertClick() {
  const m = map.value
  if (!m) return
  cleanupAll()
  mode.value = "insert"

  // 临时绘制层
  const drawSource = new VectorSource()
  const drawLayer = new VectorLayer({
    source: drawSource,
    style: new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: "#e74c3c" }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
      }),
    }),
  })
  m.addLayer(drawLayer)
  tempLayers.push(drawLayer)

  const draw = new Draw({ source: drawSource, type: "Point" })
  m.addInteraction(draw)
  activeInteractions.push(draw)

  draw.on("drawend", (e: any) => {
    const feature = e.feature
    draw.setActive(false)

    ElMessageBox.confirm(
      "确定新增这个点位吗？",
      "确认新增",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "info" }
    ).then(() => {
      sendWFSInsert(feature)
    }).catch(() => {
      drawSource.clear()
      draw.setActive(true)
    })
  })
}

function updateClick() {
  const m = map.value
  if (!m || !wfsLayer) return
  cleanupAll()
  mode.value = "update"

  const select = new Select({
    layers: [wfsLayer],
    style: selectStyle,
  })
  m.addInteraction(select)
  activeInteractions.push(select)

  // Modify 监听 Select 的选中集合
  const modify = new Modify({ features: select.getFeatures() })
  m.addInteraction(modify)
  activeInteractions.push(modify)

  modify.on("modifyend", (e: any) => {
    const feature = e.features.item(0)
    if (!feature) return

    ElMessageBox.confirm(
      "确定保存此要素的修改吗？",
      "确认修改",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "info" }
    ).then(() => {
      sendWFSUpdate(feature)
    }).catch(() => {
      // 取消→刷新 source 恢复原样
      wfsLayer?.getSource()?.refresh()
    })
  })
}

function deleteClick() {
  const m = map.value
  if (!m || !wfsLayer) return
  cleanupAll()
  mode.value = "delete"

  const select = new Select({
    layers: [wfsLayer],
    style: selectStyle,
  })
  m.addInteraction(select)
  activeInteractions.push(select)

  select.on("select", (e: any) => {
    const feature = e.selected[0]
    if (!feature) return
    // 选中后暂停 Select（阻止连续触发）
    select.setActive(false)

    const props = feature.getProperties()
    const name = props.name || props.id || "未知"
    ElMessageBox.confirm(
      `确定删除「${name}」吗？`,
      "确认删除",
      { confirmButtonText: "确定", cancelButtonText: "取消", type: "warning" }
    ).then(() => {
      sendWFSDelete(feature)
    }).catch(() => {
      // 取消→重新启用 Select
      select.getFeatures().clear()
      select.setActive(true)
    })
  })
}

function finishClick() {
  cleanupAll()
  mode.value = ""
}

// ── WFS-T 发送 ────────────────────────────────────────────

/**
 * 发送 WFS-T 事务请求
 * @param feature   要操作的 OL Feature
 * @param type      insert / update / delete
 * @param callback  成功后回调（默认刷新 source）
 */
function sendWFSTransaction(
  feature: any,
  type: "insert" | "update" | "delete",
  callback?: () => void
) {
  const ft = feature.clone()

  if (type === "insert") {
    // 业务属性（参考示例的字段结构）
    const props: Record<string, any> = {
      address: "测试要素",
      name: "新增",
      porttype: "通用港口",
      province: "未知",
    }
    // lng/lat 存 4326 坐标
    const geom3857 = ft.getGeometry().clone()
    const geom4326 = geom3857.transform("EPSG:3857", "EPSG:4326")
    const coords = geom4326.getCoordinates()
    props.lng = +coords[0].toFixed(6)
    props.lat = +coords[1].toFixed(6)

    ft.setProperties(props)

    // 几何属性名改为 geom（PostGIS 字段名）
    const geom = ft.getGeometry()
    ft.unset("geometry")
    ft.set("geom", geom)
    ft.setGeometryName("geom")
  } else if (type === "update") {
    ft.setId(feature.getId())
    // 同样修正几何字段名
    const geom = ft.getGeometry()
    ft.unset("geometry")
    ft.set("geom", geom)
    ft.setGeometryName("geom")
  } else if (type === "delete") {
    ft.setId(feature.getId())
  }

  const wfsSerializer = new WFSFormat()
  let inserts: any = null, updates: any = null, deletes: any = null
  // 使用中括号 [ft] 是为了将要素对象包装成一个数组。
  // 查看 OpenLayers 中 WFSFormat 的 writeTransaction 方法签名，它的前三个参数
  //（分别对应插入、更新、删除的要素）期望接收的类型都是 Feature[]（即要素数组），
  // 而不是单个 Feature 对象。
  if (type === "insert") inserts = [ft] 
  else if (type === "update") updates = [ft] 
  else deletes = [ft]

  const xmlDoc = wfsSerializer.writeTransaction(inserts, updates, deletes, {
    featureNS: FEATURE_NS, // GeoServer 工作空间的命名空间 URI
    featurePrefix: WS_NAME, // GeoServer 工作空间名称
    featureType: LAYER_NAME, // GeoServer 图层名称
    srsName: SRS_NAME, // 坐标系，WFS-T 默认使用 EPSG:4326（经纬度），这里改为 EPSG:3857
  } as any)

  const xmlStr = new XMLSerializer().serializeToString(xmlDoc)

  fetch(GEOSERVER_WFS, {
    method: "POST",
    body: xmlStr,
    headers: { "Content-Type": "application/xml" },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.text()
    })
    .then((text) => {
      if (text.includes("Exception")) {
        console.error("WFS-T 失败:", text)
        ElMessage.error(`${type}失败，详情见控制台`)
        return
      }
      ElMessage.success(`${type === "insert" ? "新增"
        : type === "update" ? "修改" : "删除"}成功`)
      // 刷新数据
      wfsLayer?.getSource()?.refresh()
      if (callback) callback()
    })
    .catch((err) => {
      ElMessage.error(`${type}请求失败: ${err.message}`)
    })
}

function sendWFSInsert(feature: any) {
  // 插入成功后清理绘制图层，回到浏览模式
  sendWFSTransaction(feature, "insert", () => {
    finishClick()
  })
}

function sendWFSUpdate(feature: any) {
  sendWFSTransaction(feature, "update", () => {
    finishClick()
  })
}

function sendWFSDelete(feature: any) {
  sendWFSTransaction(feature, "delete", () => {
    finishClick()
  })
}

//#region ── WFS writeGetFeature 查询示例 ──────────────────────────────────────────

/**
 * WFS 带过滤条件的 CQL 查询 — POST 方式
 *
 * 原理：
 *   WFS 支持用 Filter 编码（OGC Filter Encoding）在请求中嵌入类似 SQL WHERE 的条件。
 *   OL 的 ol/format/filter 提供了便捷的构造方法，自动序列化成 XML 发送给 GeoServer。
 *
 * 这里演示的组合查询等价于 SQL：
 *   WHERE porttype LIKE '沿海' AND name = '珠海港'
 *
 * 数据源为 webgistest:port 港口图层，查询结果仅打印到控制台，不做地图渲染。
 */
function findData() {
  /**
   * 构造 OGC Filter 对象：
   *   like('字段名', '匹配模式')
   *     → 相当于 SQL: porttype LIKE '沿海'
   *     % 是通配符（默认 wildCard），这里不加 % 就是精确匹配
   *   equalTo('字段名', '值')
   *     → 相当于 SQL: name = '珠海港'
   *   and(条件1, 条件2)
   *     → 相当于 SQL: 条件1 AND 条件2
   */
  const filterObj = and(
    like('porttype', '沿海'),
    equalTo('name', '珠海港')
  )

  // writeGetFeature 把 JS 配置 → WFS GetFeature 请求的 XML 文档
  const request = new WFSFormat().writeGetFeature({
    srsName: SRS_NAME,
    featureNS: FEATURE_NS,
    featurePrefix: WS_NAME,
    featureTypes: [LAYER_NAME],
    outputFormat: 'application/json',
    filter: filterObj,
  })

  const xmlStr = new XMLSerializer().serializeToString(request)
  console.log('📤 WFS 查询请求 XML:', xmlStr)

  fetch(GEOSERVER_WFS, {
    method: 'POST',
    body: xmlStr,
    headers: { 'Content-Type': 'application/xml' },
  })
    .then((res) => res.json())
    .then((json) => {
      console.log('📦 WFS 查询结果（原始 GeoJSON）:', json)
      /**
       * json.features 是 GeoJSON 的要素数组，结构如：
       *   {
       *     type: "FeatureCollection",
       *     features: [
       *       { type: "Feature", id: "port.123", geometry: {...}, properties: {...} }
       *     ]
       *   }
       */
      if (json.features?.length) {
        console.log(`✅ 查到 ${json.features.length} 条记录:`)
        json.features.forEach((f: any) => {
          console.log(`   · ${f.properties.name}（${f.properties.province}）— ${f.properties.porttype}`)
        })
      } else {
        console.log('ℹ️ 无匹配结果（可能字段值不匹配）')
      }

      // ── 如果需要展示到地图，用 GeoJSON format 读取并添加到 source ──
      // const reader = new GeoJSON({ geometryName: 'geom' })
      // const features = reader.readFeatures(json)
      // wfsLayer?.getSource()?.addFeatures(features)
    })
    .catch((err) => {
      console.error('❌ WFS 查询失败:', err)
    })
}
// #endregion

// ── 生命周期 ──────────────────────────────────────────────
onMounted(() => {
  const m = map.value
  if (!m) return
  loadWfsLayer(m)
})
</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}

/* ── WFS 工具栏 ────────────────────────────────────────── */
.wfs-toolbar {
  position: absolute;
  top: 12px;
  left: 370px;  // 放在 SearchBox 右侧
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 8px;
}

.mode-hint {
  font-size: 13px;
  color: var(--el-color-primary);
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 10px;
  border-radius: 4px;
  white-space: nowrap;
}

.map-controls-right {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
</style>