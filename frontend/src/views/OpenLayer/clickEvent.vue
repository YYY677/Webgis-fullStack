<template>
  <div id="map" class="map"></div>

  <!-- 弹窗 -->
  <div ref="popupRef" class="ol-popup">
    <div ref="popupContent"></div>
  </div>
</template>

<script setup lang="ts">
import 'ol/ol.css'
import { onMounted, ref } from 'vue'

import Map from 'ol/Map'
import View from 'ol/View'
import Overlay from 'ol/Overlay'

import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'

import XYZ from 'ol/source/XYZ'
import VectorSource from 'ol/source/Vector'

import GeoJSON from 'ol/format/GeoJSON'

import { Style, Fill, Stroke } from 'ol/style'

import { fromLonLat } from 'ol/proj'

// DOM
const popupRef = ref<HTMLDivElement>()
const popupContent = ref<HTMLDivElement>()

onMounted(() => {
  // ✅ WFS（已经转成3857）
  const wfsUrl =
    '/geoserver/Yuu/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=Yuu:London_Borough_Excluding_MHW&outputFormat=application/json&srsName=EPSG:3857'

  // 矢量数据源
  const vectorSource = new VectorSource({
    url: wfsUrl,
    format: new GeoJSON(),
  })

  // 默认样式
  const defaultStyle = new Style({
    stroke: new Stroke({
      width: 1,
    }),
    fill: new Fill({
      color: 'rgba(0,0,255,0.2)',
    }),
  })

  // 高亮样式
  const highlightStyle = new Style({
    stroke: new Stroke({
      width: 2,
    }),
    fill: new Fill({
      color: 'rgba(255,0,0,0.5)',
    }),
  })

  // 矢量图层
  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: defaultStyle,
  })

  // 弹窗 Overlay
  const overlay = new Overlay({
    element: popupRef.value!,
    positioning: 'bottom-center',
    stopEvent: false,
    offset: [0, -10],
  })

  // 地图
  const map = new Map({
    target: 'map',
    layers: [
      new TileLayer({
        source: new XYZ({
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        }),
      }),
      vectorLayer,
    ],
    overlays: [overlay],
    view: new View({
      center: fromLonLat([-0.1, 51.5]),
      zoom: 10,
    }),
  })

  // 自动缩放到数据
  vectorSource.on('featuresloadend', () => {
    map.getView().fit(vectorSource.getExtent(), {
      duration: 800,
    })
  })

  let selectedFeature: any = null

  // 点击事件
  map.on('click', (evt) => {
    // 获取点击的 feature
    const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f)

    // 清除旧高亮
    if (selectedFeature) {
      selectedFeature.setStyle(defaultStyle)
    }

    if (feature) {
      // 设置高亮
      feature.setStyle(highlightStyle)
      selectedFeature = feature

      // 获取属性（重点！）
      const props = feature.getProperties()

      // 👉 这里字段名要看你数据（可能是 name / NAME / borough）
      const name =
        props.name || props.NAME || props.borough || '未知区域'

      // 设置弹窗内容
      popupContent.value!.innerHTML = `<b>${name}</b>`

      // 显示弹窗
      overlay.setPosition(evt.coordinate)
    } else {
      // 点击空白关闭
      overlay.setPosition(undefined)
    }
  })
})
</script>

<style>
.map {
  width: 100%;
  height: 800px;
}

/* 弹窗样式 */
.ol-popup {
  background: white;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 14px;
}
</style>
