<template>
  <div id="cesiumContainer"></div>
</template>

<script setup>
window.CESIUM_BASE_URL = "./Cesium";
import {
  Cartesian3,
  createOsmBuildingsAsync,
  Ion,
  Math as CesiumMath,
  Terrain,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { onMounted } from "vue";
onMounted(() => {
  init();
});
function init() {
  Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJkY2MzMTFiMi00MmJhLTQ4NzEtYTEwYi05MGI0NzdkMTY1ZDkiLCJpZCI6MjE2ODA3LCJzdWIiOiJZWVk2NzciLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoiVW50aXRsZWQiLCJpYXQiOjE3ODA5MjI1OTN9.7kj5EnRQOLO4PvM65nVpx3sszLKEiAqWEXkopX9f540';
  window.CESIUM_BASE_URL = "./Cesium/";
  const viewer = new Viewer("cesiumContainer", {
    // terrainProvider: Cesium.createWorldTerrain(),
    navigationHelpButton: false,
    timeline: false,
    fullscreenButton: false,
    animation: false,
    BaseLayerPicker: false,
    HomeButton: false,
    ProjectionPicker: false,
  });
}

</script>

<style>
#cesiumContainer {
  position: absolute;
  height: 100vh;
  width: 100%;
  inset: 0;
}

.cesium-viewer-bottom {
  display: none !important;
}

.cesium-viewer-toolbar {
  display: none !important;
}
</style>
