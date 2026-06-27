<template>
  <div id="ol-map" class="map-container" style="position: relative">
    <BasemapSwitcher :set-base-layer="setBaseLayer" />
  </div>
</template>

<script setup lang="ts">
import "ol/ol.css"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"

const { setBaseLayer } = useMap("ol-map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [116.4, 39.9],
  view: { zoom: 5 }
})
</script>

<style scoped>
.map-container { width: 100%; height: calc(100vh - 50px); }
</style>
