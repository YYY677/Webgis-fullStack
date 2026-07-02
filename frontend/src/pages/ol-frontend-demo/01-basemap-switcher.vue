<template>
  <div id="basemap-demo" class="map-container" style="position: relative">
    <!-- 通过props的方式向组件传输了setBaseLayer这个方法，有必要这么做吗？
    BasemapSwitcher内部不能直接从useMap中获取setBaseLayer方法吗？ -->
    <!-- 从直觉上看确实像是多此一举。原因在于 useMap 的职责：
    useMap 的每次调用都会创建一张新地图。 它不是一个全局单例，而是一个每页调用一次的生命周期工具。
    所以 BasemapSwitcher 内部不能自己调 useMap 拿到 setBaseLayer——那样它会新建一个地图，
    跟父页面的地图毫无关系。-->
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"

const { map, setBaseLayer } = useMap("basemap-demo", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

console.log("BASEMAP_LIST[0].create()\n", BASEMAP_LIST[0].create())
console.log("setBaseLayer\n", setBaseLayer)

</script>

<style scoped>
.map-container { width: 100%; height: 100%; }
.map-controls-right {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
</style>
