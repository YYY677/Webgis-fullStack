<template>
  <div id="map" class="map-container" style="position: relative">
    <BasemapSwitcher :set-base-layer="setBaseLayer" />
    <BasicToolBox v-if="map" :map="map" />
  </div>
</template>

<script setup lang="ts">
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue";

const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

</script>

<style scoped>
.map-container { width: 100%; height: 100%; }
</style>
