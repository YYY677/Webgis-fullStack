<template>
  <div id="wfs-map" class="map-container" style="position: relative">
    <BasemapSwitcher :set-base-layer="setBaseLayer" />
    <!-- WFS 要素弹出框（跟底图无关，独立浮层） -->
    <div ref="popupRef" class="ol-popup">
      <div ref="popupContent"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import "ol/ol.css"
import Overlay from "ol/Overlay"
import VectorLayer from "ol/layer/Vector"
import VectorSource from "ol/source/Vector"
import GeoJSON from "ol/format/GeoJSON"
import { Style, Fill, Stroke } from "ol/style"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"

const popupRef = ref<HTMLDivElement>()
const popupContent = ref<HTMLDivElement>()

// 地图实例 + 底图切换 — useMap 负责创建 Map、销毁、resize
const { map, setBaseLayer } = useMap("wfs-map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [-0.1, 51.5],
  view: { zoom: 10 }
})

// WFS 逻辑 — 在 useMap 的 onMounted 之后运行，此时 map.value 已就绪
onMounted(() => {
  const geoserverUrl = import.meta.env.VITE_GEOSERVER_URL || "/geoserver"
  const wfsUrl = `${geoserverUrl}/Yuu/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Yuu:London_Borough_Excluding_MHW&outputFormat=application/json&srsName=EPSG:3857`

  const vectorSource = new VectorSource({ url: wfsUrl, format: new GeoJSON() })
  const defaultStyle = new Style({ stroke: new Stroke({ width: 1 }), fill: new Fill({ color: "rgba(0,0,255,0.2)" }) })
  const highlightStyle = new Style({ stroke: new Stroke({ width: 2 }), fill: new Fill({ color: "rgba(255,0,0,0.5)" }) })
  const vectorLayer = new VectorLayer({ source: vectorSource, style: defaultStyle })
  const overlay = new Overlay({ element: popupRef.value!, positioning: "bottom-center", stopEvent: false, offset: [0, -10] })

  const m = map.value!
  m.addLayer(vectorLayer)
  m.addOverlay(overlay)

  // 数据加载后自动缩放到范围
  vectorSource.on("featuresloadend", () => {
    const extent = vectorSource.getExtent()
    if (extent) m.getView().fit(extent, { duration: 800 })
  })

  // 点击要素高亮 + 弹窗
  let selectedFeature: any = null
  m.on("click", (evt) => {
    const feature = m.forEachFeatureAtPixel(evt.pixel, (f) => f) as any
    if (selectedFeature) selectedFeature.setStyle(defaultStyle)
    if (feature) {
      feature.setStyle(highlightStyle)
      selectedFeature = feature
      const props = feature.getProperties()
      const name = props.name || props.NAME || props.borough || "未知区域"
      popupContent.value!.innerHTML = `<b>${name}</b>`
      overlay.setPosition(evt.coordinate)
    } else {
      overlay.setPosition(undefined)
    }
  })
})
</script>

<style scoped>
.map-container { width: 100%; height: calc(100vh - 50px); }
.ol-popup { position: absolute; background: white; padding: 6px 10px; border-radius: 6px; border: 1px solid #ccc; font-size: 14px; pointer-events: none; }
</style>
