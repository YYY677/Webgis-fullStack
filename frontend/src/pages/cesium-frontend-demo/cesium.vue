<template>
  <div id="cesiumContainer" class="map-container" />
</template>

<script setup lang="ts">
import { onMounted } from "vue"
import { Ion, Viewer } from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"

onMounted(() => {
  const token = import.meta.env.VITE_CESIUM_TOKEN
  Ion.defaultAccessToken = token
  new Viewer("cesiumContainer", {
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
.map-container { width: 100%; height: calc(100vh - 50px); overflow: hidden; }
:deep(.cesium-viewer-bottom) { display: none !important; }
:deep(.cesium-viewer-toolbar) { display: none !important; }
</style>
