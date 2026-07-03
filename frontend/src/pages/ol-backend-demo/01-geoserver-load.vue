<template>
  <div id="map" class="map-container">
    <SearchBox v-if="map" :map="map" />
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>

</template>

<script lang="ts" setup>
// vue 
import { onMounted, ref } from "vue"
// 底图和地图控件
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue";
import LayerControl from "@/components/LayerControl.vue";
import MapSetting from "@/components/MapSetting.vue";
import SearchBox from "@/components/SearchBox.vue";
import TileLayer from "ol/layer/Tile"
import { Image as ImageLayer } from "ol/layer"
import { ImageWMS } from "ol/source"
import { WMTS } from 'ol/source'
import WMTSGrid from 'ol/tilegrid/WMTS'
import TileWMS from 'ol/source/TileWMS'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { bbox as bboxStrategy } from 'ol/loadingstrategy'
import { WFS } from 'ol/format'
import { Style, Fill, Stroke } from 'ol/style'
import XYZ from 'ol/source/XYZ';
// 类型
import type { LayerInfo } from "@/components/LayerControl.vue"

const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5, maxZoom: 20, minZoom: 0 }
})

const layerInfos: LayerInfo[] = []
// const layerInfos = []


onMounted(() => {
  // wmsImageLayer()
  wmsTileLayer()
  // wmtsLayer()
  // wfsLayer()
})

/**
 * 特点：每次视图变化都重新请求一张完整的大图。适合数据量小、交互不频繁的场景，
 * 实时渲染能力最强（可动态过滤、动态样式）。 
 */
const wmsImageLayer = () => {
  let wms = new ImageLayer({
    source: new ImageWMS({
      // vite.config.ts 的 proxy 规则匹配 "/geoserver" 
      url: "/geoserver/wms",
      params: {
        'FORMAT': 'image/png', // 图像格式
        'VERSION': '1.1.1', // WMS 版本
        LAYERS: 'ne:countries', // 图层名称
        'SRS': 'EPSG:3857' // 自动投影到目标坐标系
        // 可以加 CQL_FILTER 等动态参数
      },
      serverType: 'geoserver', // 服务器类型
    })
  })
  map.value?.addLayer(wms)
}

/**
 * 自动把地图切成任意像素比的瓦片请求，尺寸很灵活，WMTS：严格固定，无法修改。
 * 利用浏览器缓存和服务端 GWC 缓存（GeoServer 会默认缓存这些请求）。
 * 性能比单图模式好很多，且依然支持动态参数（如 CQL_FILTER）。这是 WMS 业务专题图的首选模式。
 */
const wmsTileLayer = () => {
  const layer = new TileLayer({
    source: new TileWMS({
      url: '/geoserver/wms',
      params: {
        'LAYERS': 'ne:countries',
        'TILED': true,           // 关键：告诉服务器按瓦片返回
        'FORMAT': 'image/png',
        'VERSION': '1.1.1',
        // 'CQL_FILTER': "pop_est > 10000000"  // 可加动态过滤
      },
      serverType: 'geoserver',
      // 可选：设置缓存策略
      cacheSize: 2048, // OpenLayers 客户端内存缓存，存储在浏览器当前页面的 JavaScript 内存
    })
  })
  map.value?.addLayer(layer)
}

/**
 * WMTS（Web Map Tile Service）是 WMS 的瓦片化版本，服务端预先生成瓦片缓存，客户端按瓦片请求。
 * 优点：性能最好，适合大数据量的底图和专题图（样式固定、数据不变）。
 * 缺点：不支持动态参数（如 CQL_FILTER），因为瓦片是预先生成的。
 */
const wmtsLayer = () => {
  // 数据是 EPSG:4326，使用 4326 网格集（度为单位），OL 会自动重投影到 3857 视图
  const projection = 'EPSG:4326';
  let resolutions = new Array(21)
  let matrixIds = new Array(21)
  for (let z = 0; z < 21; ++z) {
    // GeoServer EPSG:4326 网格集：分辨率从 180/256 开始逐级减半
    resolutions[z] = 180 / (256 * Math.pow(2, z))
    matrixIds[z] = 'EPSG:4326:' + z
  }
  // 关于坐标系转换：
  // WMTS 可以靠 runtime 重投影自动适配，GeoJSON 必须在读数据时就转好。
  let wmtsSource = new WMTS({
    url: "/geoserver/gwc/service/wmts?service=WMTS&version=1.0.0&request=GetTile",
    layer: 'ne:countries',
    matrixSet: 'EPSG:4326',
    format: 'image/png',
    projection: projection, // 原数据的坐标系，OL 会自动重投影到视图坐标系 EPSG:3857
    tileGrid: new WMTSGrid({
      tileSize: [256, 256],
      extent: [-180, -90, 180, 90],
      origin: [-180, 90],
      resolutions: resolutions,
      matrixIds: matrixIds
    }),
    // GeoServer GWC 的实现问题和 OGC 标准打架。
    // WMTS 1.0.0 规范明确规定 style 是必填参数。OL 严格遵循标准，所以默认把 style 拼进 URL。
    // GeoServer 的 GWC（瓦片缓存）WMTS 接口不接受 style 参数，传了就 400。
    // 因此这里显式指定 style: ""，让 OL 不拼 style 参数。
    style: '',
    wrapX: true //允许经度循环
  })
  let wmtsLayer = new TileLayer({
    source: wmtsSource,
  })
  map.value?.addLayer(wmtsLayer)
}

/**
 * WFS（Web Feature Service）是矢量要素服务，返回 GeoJSON 或 GML 等格式的矢量数据。
 * 优点：客户端可以自由控制样式、交互（点击、悬停）, 适合需要查询、编辑或动态渲染的应用。
 * 缺点：数据量大时性能差，因为每次视图变化都要重新请求数据，需要配合分页或 BBOX 策略。
 */
const wfsLayer = () => {
  const source = new VectorSource({
    format: new GeoJSON({
      dataProjection: 'EPSG:4326',     // 声明数据源头是经纬度（WFS 默认存储）
      featureProjection: 'EPSG:3857'   // 声明要让 OL 重投影到当前视图坐标系
    }),
    // 需要指定返回类型为GeoJSON，默认为 GML
    url: '/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=ne:countries&srsname=EPSG:3857&outputFormat=application/json',
    strategy: bboxStrategy,   // 按视图范围请求
    /*
    在 OpenLayers 中，VectorSource 的构造配置项（Options）并不包含 params 属性。
    params 是 ImageWMS 或 TileWMS 等 WMS 数据源特有的配置项，用于向服务器传递动态查询参数。
    对于 WFS 服务的 VectorSource，请求参数（如 service、version、request、typeName 等）
    应当直接拼接在 url 属性中作为查询字符串。
    */
    // params: {
    //   service: 'WFS',
    //   version: '1.1.0',
    //   request: 'GetFeature',
    //   typeName: 'ne:countries',
    //   srsname: 'EPSG:3857',
    //   // 可加 CQL_FILTER 过滤属性
    //   // CQL_FILTER: "pop_est > 10000000"
    // },
  });
  const layer = new VectorLayer({
    source: source,
    style: new Style({
      stroke: new Stroke({ color: '#ff0000', width: 2 }),
      fill: new Fill({ color: 'rgba(255, 0, 0, 0.2)' }),
    })
  });
  map.value?.addLayer(layer)
  map.value?.on("click", (evt: any) => {
    const feature = map.value?.forEachFeatureAtPixel(evt.pixel, (f) => f)
    if (feature) {
      const props = feature.getProperties()
      console.log("点击要素属性：", props)
    }
  })
}

</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
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