<template>
  <div id="map" class="map-container" style="position: relative">
    <SearchBox v-if="map" :map="map" />
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
      <MapSetting v-if="map" :map="map" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue";
import LayerControl from "@/components/LayerControl.vue";
import SearchBox from "@/components/SearchBox.vue";
import MapSetting from "@/components/MapSetting.vue";
import { publicUrl } from "@/utils/public-url"
import type { LayerInfo } from "@/components/LayerControl.vue"
import GeoJSON from "ol/format/GeoJSON"
import { Vector as VectorSource } from "ol/source"
import Cluster from "ol/source/Cluster"
import { Vector as VectorLayer } from "ol/layer"
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from "ol/style"
import { Overlay } from "ol"

const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

const layerInfos = ref<LayerInfo[]>([])

/** 聚合样式 — 根据 count 显示不同大小的圆 */
const clusterStyle = (feature: any) => {
  const features = feature.get("features")
  const count = features.length
  // 根据数量选颜色和大小 
  const radius = count > 50 ? 24 : count > 10 ? 18 : 12
  const color = count > 50 ? "#e74c3c" : count > 10 ? "#f39c12" : "#3498db"

  return new Style({
    image: new CircleStyle({
      radius,
      fill: new Fill({ color: "rgba(255, 255, 255, 0.8)" }),
      stroke: new Stroke({ color, width: 3 }),
    }),
    text: new Text({
      text: String(count),
      font: "bold 14px Arial",
      fill: new Fill({ color }),
    }),
  })
}

/** 单个大学标记样式 */
const singleStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({ color: "red" }),
    stroke: new Stroke({ color: "#fff", width: 2 }),
  }),
})

onMounted(async () => {
  const m = map.value!;

  // 加载大学数据
  const res = await fetch(publicUrl("test_data/university.geojson"))
  const geojson = await res.json()
  const features = new GeoJSON().readFeatures(geojson, {
    featureProjection: "EPSG:3857",
  })

  // 矢量源（放所有要素）
  const vectorSource = new VectorSource({ features })

  // Cluster 源包裹矢量源
  const clusterSource = new Cluster({
    source: vectorSource,
    distance: 50, // 像素距离内聚合成一组
    minDistance: 30, // 聚合点之间的最小距离，避免重叠
  })

  const clusterLayer = new VectorLayer({
    source: clusterSource,
    style: (feature: any) => {
      const features = feature.get("features")
      return features.length === 1 ? singleStyle : clusterStyle(feature)
    },
    zIndex: 20,
  })
  m.addLayer(clusterLayer)
  layerInfos.value.push({ id: "univ-cluster", name: "大学分布（聚合）", type: "vector", layer: clusterLayer })

  // 弹窗 Overlay
  const popupEl = document.createElement("div")
  popupEl.className = "univ-popup"
  const popup = new Overlay({
    element: popupEl,
    positioning: "bottom-center", // 弹窗相对于坐标点的定位方式
    offset: [0, -8], // 弹窗向上偏移 8px，避免遮挡标记
  })
  m.addOverlay(popup)

  // 鼠标悬停
  m.on("pointermove", (evt) => {
    m.getTargetElement().style.cursor = m.hasFeatureAtPixel(evt.pixel) ? "pointer" : ""
  })

  // 点击：聚合展开 / 单点显示名称
  m.on("click", (evt) => {
    popup.setPosition(undefined)

    m.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      // 只处理 clusterLayer
      if (layer !== clusterLayer) return

      const childFeatures = feature.get("features") as any[]
      if (!childFeatures || childFeatures.length === 0) return
      /**
       * OL Cluster：forEachFeatureAtPixel 返回的是 cluster 的虚拟 feature
       * feature.get("features") 拿到其包裹的原始要素数组
       * 一个要素 → 显示名称
       * 多个要素 → fit 到所有子要素的范围
       */
      if (childFeatures.length === 1) {
        // 单个大学 → 弹窗显示名称
        const f = childFeatures[0]
        const name = f.get("name")
        if (name) {
          popupEl.innerHTML = name
          const geom = f.getGeometry()
          console.log("单个大学坐标：", geom.getCoordinates()) // 点坐标系是当前layer坐标系
          if (geom) popup.setPosition(geom.getCoordinates())
        }
      } else {
        // 聚合点 → 缩放到包含所有子要素的范围
        // 获取第一个子要素的几何范围并创建副本
        let childExtent = childFeatures[0].getGeometry().getExtent().slice()
        // 遍历所有子要素
        childFeatures.forEach((f) => {
        // 获取当前要素的几何范围
          const ex = f.getGeometry().getExtent()
        // 计算所有要素的最小X坐标
          childExtent[0] = Math.min(childExtent[0], ex[0])
        // 计算所有要素的最小Y坐标
          childExtent[1] = Math.min(childExtent[1], ex[1])
        // 计算所有要素的最大X坐标
          childExtent[2] = Math.max(childExtent[2], ex[2])
        // 计算所有要素的最大Y坐标
          childExtent[3] = Math.max(childExtent[3], ex[3])
        })
        // 将视图适配到计算出的要素范围
        m.getView().fit(childExtent, {
          // 设置视图内边距为60像素
          padding: [60, 60, 60, 60],
          // 设置视图动画持续时间为500毫秒
          duration: 500,
          // 设置视图最大缩放级别为15
          maxZoom: 14,
        })
      }
    })
  })
})
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
  gap: 10px;
}

:global(.univ-popup) {
  background: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  pointer-events: none;
}
</style>
