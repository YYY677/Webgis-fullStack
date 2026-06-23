<template>
  <div id="cesiumContainer" class="map-container"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

// Cesium base URL must be set before any Cesium import
;(window as any).CESIUM_BASE_URL = './Cesium/'

import {
  Cartesian3,
  createOsmBuildingsAsync,
  Ion,
  Math as CesiumMath,
  Terrain,
  Viewer
} from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

onMounted(() => {
  const cesiumToken = import.meta.env.VITE_CESIUM_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkY2MzMTFiMi00MmJhLTQ4NzEtYTEwYi05MGI0NzdkMTY1ZDkiLCJpZCI6MjE2ODA3LCJzdWIiOiJZWVk2NzciLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3ODA5MjI1OTN9.7kj5EnRQOLO4PvM65nVpx3sszLKEiAqWEXkopX9f540'

  Ion.defaultAccessToken = cesiumToken
  ;(window as any).CESIUM_BASE_URL = './Cesium/'

  new Viewer('cesiumContainer', {
    navigationHelpButton: false,
    timeline: false,
    fullscreenButton: false,
    animation: false,
    baseLayerPicker: false,
    homeButton: false,
    projectionPicker: false
  })
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: calc(100vh - 84px);
  overflow: hidden;
}

:deep(.cesium-viewer-bottom) {
  display: none !important;
}

:deep(.cesium-viewer-toolbar) {
  display: none !important;
}
</style>
