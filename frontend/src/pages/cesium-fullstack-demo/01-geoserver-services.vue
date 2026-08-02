<template>
  <div class="cesium-page">
    <div id="cesiumGeoServerMap" class="map-root"></div>

    <div class="map-controls">
      <CesiumBasemapSwitcher
        :activate="switchBasemap"
        :initial="currentBasemapId"
      />
    </div>

    <aside class="panel">
      <h2>01 · GeoServer 服务接入</h2>
      <p class="intro">
        对比 WMS 动态瓦片、WMTS 缓存瓦片和 WFS 矢量要素在 Cesium
        中的加载方式。
      </p>

      <section class="service-card">
        <div>
          <strong>WMS 路网</strong>
          <small>GeoServer 动态渲染的深圳道路影像瓦片</small>
        </div>
        <el-button
          :type="serviceState.wms ? 'warning' : 'primary'"
          @click="toggleWms"
        >
          {{ serviceState.wms ? "移除" : "加载" }}
        </el-button>
      </section>

      <section class="service-card">
        <div>
          <strong>WMTS 省边界</strong>
          <small>GeoWebCache 提供的 EPSG:900913 缓存瓦片</small>
        </div>
        <el-button
          :type="serviceState.wmts ? 'warning' : 'primary'"
          @click="toggleWmts"
        >
          {{ serviceState.wmts ? "移除" : "加载" }}
        </el-button>
      </section>

      <section class="service-card">
        <div>
          <strong>WFS 港口</strong>
          <small>GeoJSON 在客户端转换为可交互 Entity</small>
        </div>
        <el-button
          :loading="wfsLoading"
          :type="serviceState.wfs ? 'warning' : 'primary'"
          @click="toggleWfs"
        >
          {{ serviceState.wfs ? "移除" : "加载" }}
        </el-button>
      </section>

      <section class="state">
        <b>最近请求</b>
        <code>{{ lastUrl || "点击服务按钮查看请求" }}</code>
      </section>
      <section class="state">
        <b>WFS 拾取属性</b>
        <pre>{{ picked || "加载港口后点击地图要素" }}</pre>
      </section>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * GeoServer WMTS GetCapabilities 中 province_border 的 WGS84 覆盖范围。
 *
 * 注意：它描述的是“这个图层在哪”，所以是经纬度（度）。它不是 WMTS
 * Rectangle.fromDegrees 的参数顺序为：[西, 南, 东, 北]。
 */
export const PROVINCE_BORDER_RECTANGLE_DEGREES = [
  73.5011421,
  6.32672623,
  135.08851148,
  53.56090105,
] as const
</script>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from "vue"
import { ElMessage } from "element-plus"
import {
  Cartesian2,
  Cartesian3,
  Color,
  GeoJsonDataSource,
  GeographicTilingScheme,
  ImageryLayer,
  LabelGraphics,
  PointGraphics,
  Rectangle,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  WebMapServiceImageryProvider,
  WebMapTileServiceImageryProvider,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import CesiumBasemapSwitcher from "@/components/CesiumBasemapSwitcher.vue"
import {
  CESIUM_BASEMAP_LIST,
  type CesiumBasemapItem,
} from "@/utils/cesium-basemaps"

const lastUrl = ref("")
const picked = ref("")
const currentBasemapId = ref("")
const wfsLoading = ref(false)
const serviceState = reactive({
  wms: false,
  wmts: false,
  wfs: false,
})

let viewer: Viewer | undefined
let wmsLayer: ImageryLayer | undefined
let wmtsLayer: ImageryLayer | undefined
let wfsSource: GeoJsonDataSource | undefined
let picker: ScreenSpaceEventHandler | undefined

// PostGIS 中的业务几何统一以 EPSG:4326（经度、纬度）保存。
// GeoServer 读取的是这些原始几何；WMS / WMTS 只是两种不同的地图服务输出。
const WMS_URL = "/geoserver/wms"
const WMTS_URL = "/geoserver/gwc/service/wmts"
const ROAD_LAYER = "webgistest:shenzhen_roads"
const BORDER_LAYER = "webgistest:province_border"
const WFS_URL = [
  "/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature",
  "typeName=webgistest:port&outputFormat=application/json&srsName=EPSG:4326",
].join("&")

function reportProviderError(serviceName: string) {
  let reported = false
  return () => {
    if (reported) return
    reported = true
    ElMessage.error(`${serviceName} 瓦片加载失败，请检查 GeoServer 服务`)
  }
}

function addWmsLayer() {
  if (!viewer) return

  /**
   * WMS 是服务端按当前 BBOX 动态渲染图片，不使用 WMTS 的 TileMatrixSet。
   *
   * 这里显式指定 GeographicTilingScheme + SRS=EPSG:4326：Cesium 依据经纬度
   * BBOX 请求图片，GeoServer 以同一地理坐标系渲染路网。图片再按 BBOX 贴到
   * Cesium 的 WGS84 椭球上，因此能和 Web Mercator 的 Mars3D 底图重合。
   * 不同影像图层可以使用不同的切片方案；Cesium 会将它们映射到同一个地球。
   */
  const provider = new WebMapServiceImageryProvider({
    url: WMS_URL,
    layers: ROAD_LAYER,
    tilingScheme: new GeographicTilingScheme(),
    srs: "EPSG:4326",
    parameters: {
      version: "1.1.1",
      transparent: "true",
      format: "image/png",
      tiled: "true",
    },
  })
  provider.errorEvent.addEventListener(reportProviderError("WMS"))
  wmsLayer = viewer.imageryLayers.addImageryProvider(provider)
  serviceState.wms = true
}

function removeWmsLayer() {
  if (viewer && wmsLayer) {
    viewer.imageryLayers.remove(wmsLayer, true)
  }
  wmsLayer = undefined
  serviceState.wms = false
}

function toggleWms() {
  if (serviceState.wms) {
    removeWmsLayer()
    return
  }
  addWmsLayer()
  lastUrl.value = [
    `${WMS_URL}?service=WMS&version=1.1.1&request=GetMap`,
    `layers=${ROAD_LAYER}&format=image/png&tiled=true`,
  ].join("&")

  viewer?.camera.flyTo({
    destination: Cartesian3.fromDegrees(114.05, 22.54, 90_000),
    duration: 1,
  })
}

function addWmtsLayer() {
  if (!viewer) return

  /**
   * WMTS 不是任意 BBOX 图片，而是服务端预定义的瓦片矩阵。
   * GeoWebCache 在 GetCapabilities 中把这套矩阵集命名为 EPSG:900913；它是
   * EPSG:3857（Web Mercator / Pseudo-Mercator）的历史别名，单位为米。
   *
   * Cesium 的 WebMapTileServiceImageryProvider 默认也是 Web Mercator 切片方案，
   * 所以此处直接使用 GeoServer 的 EPSG:900913 矩阵集。它不会把 PostGIS 中
   * EPSG:4326 的原始几何改成 900913：GeoServer / GeoWebCache 只是在输出
   * 缓存图片时将数据渲染到这套米制瓦片网格中。
   */
  const matrixLabels = Array.from(
    { length: 22 },
    (_, level) => `EPSG:900913:${level}`,
  )
  const provider = new WebMapTileServiceImageryProvider({
    url: WMTS_URL,
    layer: BORDER_LAYER,
    style: "",
    format: "image/png",
    // 必须与 WMTS GetCapabilities 的 <TileMatrixSet> 完全一致。
    tileMatrixSetID: "EPSG:900913",
    // 每一级的矩阵名同样来自能力文档，例如 EPSG:900913:0。
    tileMatrixLabels: matrixLabels,
    maximumLevel: 21,
    // 限制到图层的 WGS84 覆盖范围，避免请求中国范围外的 400 瓦片。
    rectangle: Rectangle.fromDegrees(...PROVINCE_BORDER_RECTANGLE_DEGREES),
  })
  provider.errorEvent.addEventListener(reportProviderError("WMTS"))
  wmtsLayer = viewer.imageryLayers.addImageryProvider(provider)
  serviceState.wmts = true
}

function removeWmtsLayer() {
  if (viewer && wmtsLayer) {
    viewer.imageryLayers.remove(wmtsLayer, true)
  }
  wmtsLayer = undefined
  serviceState.wmts = false
}

function toggleWmts() {
  if (serviceState.wmts) {
    removeWmtsLayer()
    return
  }
  addWmtsLayer()
  lastUrl.value = [
    `${WMTS_URL}?service=WMTS&version=1.0.0&request=GetTile`,
    `layer=${BORDER_LAYER}&tileMatrixSet=EPSG:900913`,
  ].join("&")

  viewer?.camera.flyTo({
    destination: Cartesian3.fromDegrees(100, 39.91, 10000000),
    duration: 1,
  })
}

async function toggleWfs() {
  if (!viewer) return

  if (serviceState.wfs && wfsSource) {
    viewer.dataSources.remove(wfsSource, true)
    wfsSource = undefined
    serviceState.wfs = false
    picked.value = ""
    return
  }

  wfsLoading.value = true
  try {
    lastUrl.value = WFS_URL
    const response = await fetch(WFS_URL)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const geojson = await response.json()
    wfsSource = await GeoJsonDataSource.load(geojson, {
      clampToGround: true,
    })
    await viewer.dataSources.add(wfsSource)
    // GeoJsonDataSource 将每个 GeoJSON 要素转为 Entity：Point 默认是图钉形
    // Billboard（marker）。这里换成红色圆点（PointGraphics）+ 名称标签。
    //
    // entity.point / label 等图形属性只能赋 Graphics 实例（或常量值），不能像
    // viewer.entities.add({ point: {...} }) 那样传字面量——那只是 add 构造时的
    // 语法糖，内部同样会 new PointGraphics(options)。这里的 Entity 由
    // GeoJsonDataSource 批量生成、只能事后赋值，所以用 new。
    //
    // entity.name 是 Entity 的固有浅层字段：GeoJsonDataSource 会把 GeoJSON
    // properties.name 复制过来（description 同理），其余业务字段仍留在
    // entity.properties 这个 PropertyBag 里，如 porttype、address 等。
    wfsSource.entities.values.forEach((entity) => {
      entity.billboard = undefined
      entity.point = new PointGraphics({
        color: Color.RED,
        pixelSize: 8,
        outlineColor: Color.WHITE,
        outlineWidth: 1,
      })
      entity.label = new LabelGraphics({
        // text: entity.properties?.name?.getValue(viewer!.clock.currentTime) ?? "", 
        text: entity.name ?? "", // 与上面等价      
        font: "12px sans-serif",
        fillColor: Color.YELLOW,
        pixelOffset: new Cartesian2(0, -18),
      })
    })
    serviceState.wfs = true
    await viewer.flyTo(wfsSource, { duration: 1 })
  } catch (error) {
    console.error("WFS 加载失败:", error)
    ElMessage.error("WFS 港口加载失败")
  } finally {
    wfsLoading.value = false
  }
}

async function switchBasemap(item: CesiumBasemapItem) {
  if (!viewer) return

  const restoreWms = serviceState.wms
  const restoreWmts = serviceState.wmts
  wmsLayer = undefined
  wmtsLayer = undefined
  await item.activate(viewer)
  currentBasemapId.value = item.id

  if (restoreWms) addWmsLayer()
  if (restoreWmts) addWmtsLayer()
}

onMounted(async () => {
  viewer = new Viewer("cesiumGeoServerMap", {
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
  
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(100, 39.91, 10000000),
  })

  picker = new ScreenSpaceEventHandler(viewer.scene.canvas)
  picker.setInputAction((movement: any) => {
    const item = viewer?.scene.pick(movement.position)
    const properties = item?.id?.properties
    console.log("拾取对象:", item, properties)
    if (!properties) return

    // properties 是 PropertyBag：WFS 返回的所有业务字段（porttype、address 等）
    // 都装在这里，每个字段值被包装成 Property（通常为 ConstantProperty）。
    // Property 是时间驱动的：getValue(time) 返回"模拟时钟 time 那一刻"的值，
    // 用于支持随时间变化的属性（如轨迹点位置随时间移动）。常量值取任意时刻
    // 都相同，但 API 必须统一传入 time；viewer.clock.currentTime 即当前模拟时间。
    const result: Record<string, unknown> = {}
    for (const name of properties.propertyNames) {
      result[name] = properties[name].getValue(viewer?.clock.currentTime)
    }
    picked.value = JSON.stringify(result, null, 2)
  }, ScreenSpaceEventType.LEFT_CLICK)
})

onUnmounted(() => {
  picker?.destroy()
  viewer?.destroy()
})
</script>

<style scoped lang="scss">
// 深度选择器样式，用于隐藏Cesium地球组件的默认UI元素
:deep(.cesium-viewer-bottom) { display: none !important; } // 隐藏底部工具栏
:deep(.cesium-viewer-toolbar) { display: none !important; } // 隐藏顶部工具栏

.cesium-page {
  position: relative;
  width: 100%;
  height: 100%;
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

.panel {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 10;
  width: 360px;
  max-height: calc(100% - 48px);
  box-sizing: border-box;
  padding: 20px;
  overflow-y: auto;
  color: #e6f7ff;
  background: rgb(10 24 42 / 92%);
  border: 1px solid #2d699f;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgb(0 0 0 / 28%);
}

h2 {
  margin: 0 0 10px;
  font-size: 20px;
}

.intro {
  margin: 0 0 16px;
  color: #acc9dc;
  font-size: 13px;
  line-height: 1.6;
}

.service-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid rgb(89 140 178 / 30%);
}

.service-card div {
  min-width: 0;
}

.service-card strong,
.service-card small {
  display: block;
}

.service-card small {
  margin-top: 4px;
  color: #91b5cc;
  font-size: 11px;
  line-height: 1.4;
}

.state {
  margin-top: 16px;
}

b {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
}

code,
pre {
  display: block;
  box-sizing: border-box;
  width: 100%;
  max-height: 140px;
  padding: 8px;
  overflow: auto;
  color: #bde7ff;
  font-size: 11px;
  line-height: 1.5;
  white-space: pre-wrap;
  background: #071422;
  border-radius: 4px;
}

pre {
  margin: 0;
}
</style>
