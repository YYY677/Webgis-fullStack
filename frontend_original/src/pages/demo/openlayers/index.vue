<template>
  <div id="ol-map" class="map-container"></div>
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
  const projection = getProjection('EPSG:3857')!
  const projectionExtent = projection.getExtent()
  const size = 256

  const resolutions: number[] = []
  const matrixIds: string[] = []
  for (let z = 0; z <= 18; z++) {
    resolutions[z] = (projectionExtent[2] - projectionExtent[0]) / size / Math.pow(2, z)
    matrixIds[z] = String(z)
  }

  const tiandituKey = import.meta.env.VITE_TIANDITU_KEY || 'cebaba44acf46ca9eb3d146728f39dcd'

  const tdtSource = new WMTS({
    url: `http://t0.tianditu.gov.cn/vec_w/wmts?tk=${tiandituKey}`,
    layer: 'vec',
    matrixSet: 'w',
    format: 'tiles',
    style: 'default',
    projection,
    tileGrid: new WMTSGrid({
      origin: getTopLeft(projectionExtent),
      resolutions,
      matrixIds
    }),
    wrapX: true
  })

  new Map({
    target: 'ol-map',
    layers: [new TileLayer({ source: tdtSource })],
    view: new View({ center: [12958000, 4850000], zoom: 5 })
  })
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: calc(100vh - 84px);
}
</style>
