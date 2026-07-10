<template>
  <div id="map" class="map-container">
    <SearchBox v-if="map" :map="map" />

    <!-- GeoServer 数据管理组件 -->
    <!-- v-model:layer-infos等于 :layerInfos + @update:layer-infos -->
    <GeoServerDataManager :map="map" v-model:layer-infos="layerInfos" />

    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" @reorder="onLayerReorder" />
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { shallowRef } from "vue";
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import GeoServerDataManager from "@/components/GeoServerDataManager.vue"
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

// GeoServerDataManager       ← 写（增删图层）
//        ↕ v-model 双向同步
// 主文件 layerInfos           ← 存（唯一真相源）
//        ↕ :layers prop
// LayerControl               ← 读 + 拖拽（只展示和重排，不增删）
const layerInfos = shallowRef<LayerInfo[]>([])

// 图层拖拽排序：重排层叠顺序
function onLayerReorder(newList: LayerInfo[]) {
  const idOrder = newList.map(l => l.id)
  const reordered = idOrder.map(id => layerInfos.value.find(l => l.id === id)!)
  layerInfos.value = reordered
  reordered.forEach((info, i) => info.layer.setZIndex?.((reordered.length - 1 - i) * 10))
}
</script>

<style scoped lang="scss">
.map-container {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-controls-right {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
