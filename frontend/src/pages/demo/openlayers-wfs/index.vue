<script setup lang="ts">
import GeoJSON from "ol/format/GeoJSON"
import TileLayer from "ol/layer/Tile"
import VectorLayer from "ol/layer/Vector"
import Map from "ol/Map"
import Overlay from "ol/Overlay"
import { fromLonLat } from "ol/proj"
import VectorSource from "ol/source/Vector"
import XYZ from "ol/source/XYZ"
import { Fill, Stroke, Style } from "ol/style"
import View from "ol/View"
import { onMounted, ref } from "vue"
import "ol/ol.css"

const popupRef = ref<HTMLDivElement>()
const popupContent = ref<HTMLDivElement>()

onMounted(() => {
  // WFS 矢量数据源（GeoServer）
  const geoserverUrl = import.meta.env.VITE_GEOSERVER_URL || "/geoserver"
  const wfsUrl
    = `${geoserverUrl}/Yuu/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Yuu:London_Borough_Excluding_MHW&outputFormat=application/json&srsName=EPSG:3857`

  const vectorSource = new VectorSource({
    url: wfsUrl,
    format: new GeoJSON()
  })

  const defaultStyle = new Style({
    stroke: new Stroke({ width: 1 }),
    fill: new Fill({ color: "rgba(0,0,255,0.2)" })
  })

  const highlightStyle = new Style({
    stroke: new Stroke({ width: 2 }),
    fill: new Fill({ color: "rgba(255,0,0,0.5)" })
  })

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: defaultStyle
  })

  const overlay = new Overlay({
    element: popupRef.value!,
    positioning: "bottom-center",
    stopEvent: false,
    offset: [0, -10]
  })

  const map = new Map({
    target: "wfs-map",
    layers: [
      new TileLayer({
        source: new XYZ({ url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png" })
      }),
      vectorLayer
    ],
    overlays: [overlay],
    view: new View({
      center: fromLonLat([-0.1, 51.5]),
      zoom: 10
    })
  })

  // 自动缩放到数据范围
  vectorSource.on("featuresloadend", () => {
    const extent = vectorSource.getExtent()
    if (extent) {
      map.getView().fit(extent, { duration: 800 })
    }
  })

  let selectedFeature: any = null

  // 点击：高亮 + 弹窗
  map.on("click", (evt) => {
    const feature = map.forEachFeatureAtPixel(evt.pixel, f => f) as any

    if (selectedFeature) {
      selectedFeature.setStyle(defaultStyle)
    }

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

<template>
  <div id="wfs-map" class="map-container">
    <div ref="popupRef" class="ol-popup">
      <div ref="popupContent" />
    </div>
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  height: calc(100vh - 84px);
  position: relative;
}

.ol-popup {
  position: absolute;
  background: white;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 14px;
  pointer-events: none;
}
</style>
