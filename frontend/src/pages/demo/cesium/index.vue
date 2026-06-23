<script setup lang="ts">
import { Ion, Viewer } from "cesium"
import { onMounted } from "vue"
import "cesium/Build/Cesium/Widgets/widgets.css"

onMounted(() => {
  const cesiumToken = import.meta.env.VITE_CESIUM_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkY2MzMTFiMi00MmJhLTQ4NzEtYTEwYi05MGI0NzdkMTY1ZDkiLCJpZCI6MjE2ODA3LCJzdWIiOiJZWVk2NzciLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3ODA5MjI1OTN9.7kj5EnRQOLO4PvM65nVpx3sszLKEiAqWEXkopX9f540"

  Ion.defaultAccessToken = cesiumToken

  const _viewer = new Viewer("cesiumContainer", {
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

<template>
  <div id="cesiumContainer" class="map-container" />
</template>

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
