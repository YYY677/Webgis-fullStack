<template>
  <div id="map" class="map-container">
    <SearchBox v-if="map" :map="map" />
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos"/>
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>

</template>

<script lang="ts" setup>
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue";
import LayerControl from "@/components/LayerControl.vue";
import MapSetting from "@/components/MapSetting.vue";
import SearchBox from "@/components/SearchBox.vue";
import type { LayerInfo } from "@/components/LayerControl.vue"

const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

const layerInfos: LayerInfo[] = []

</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-controls-right{
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

</style>