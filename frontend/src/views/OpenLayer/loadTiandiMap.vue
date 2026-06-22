<template>
  <div id="map"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

import Map from 'ol/Map'
import View from 'ol/View'

import TileLayer from 'ol/layer/Tile'

import WMTS from 'ol/source/WMTS'
import WMTSGrid from 'ol/tilegrid/WMTS'

import { getTopLeft } from 'ol/extent'
import { get as getProjection } from 'ol/proj'

import 'ol/ol.css'

onMounted(() => {
  const projection = getProjection('EPSG:3857')

  const projectionExtent = projection!.getExtent()

  const size = 256

  const resolutions = []
  const matrixIds = []

  for (let z = 0; z <= 18; z++) {
    resolutions[z] =
      (projectionExtent[2] - projectionExtent[0]) /
      size /
      Math.pow(2, z)

    matrixIds[z] = z
  }

  const tdtSource = new WMTS({
    url: 'http://t0.tianditu.gov.cn/vec_w/wmts?tk=cebaba44acf46ca9eb3d146728f39dcd',

    layer: 'vec',

    matrixSet: 'w',

    format: 'tiles',

    style: 'default',

    projection: projection,

    // WMTSGrid本质就是瓦片编号规则
    tileGrid: new WMTSGrid({
      origin: getTopLeft(projectionExtent), // 左上角坐标作为原点坐标
      resolutions, // 一个像素代表多少米
      matrixIds, // 其实就是缩放级别
    }),

    wrapX: true,
  })

  const map = new Map({
    target: 'map',

    layers: [
      new TileLayer({
        source: tdtSource,
      }),
    ],

    view: new View({
      center: [12958000, 4850000],
      zoom: 5,
    }),
  })
})
</script>

<style scoped>
#map {
  width: 100vw;
  height: 100vh;
}
</style>
