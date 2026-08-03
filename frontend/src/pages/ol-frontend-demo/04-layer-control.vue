<template>
  <div id="map" class="map-container" style="position: relative">
    <div class="map-controls-right">
      <BasemapSwitcher :set-base-layer="setBaseLayer" />
      <BasicToolBox v-if="map" :map="map" />
      <LayerControl v-if="map" :map="map" :layers="layerInfos" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue"
import LayerControl from "@/components/LayerControl.vue"
import { publicUrl } from "@/utils/public-url"
import type { LayerInfo } from "@/components/LayerControl.vue"
// OL 模块引入
import GeoJSON from "ol/format/GeoJSON"
import { Overlay } from "ol"
import { Vector as VectorSource } from "ol/source"
import { Vector as VectorLayer, Heatmap as HeatmapLayer } from "ol/layer"
import { Style, Stroke, Fill, Text, RegularShape, Circle } from "ol/style"
import Select from "ol/interaction/Select"
import type { Map } from "ol"

/** 通用 GeoJSON 加载器：fetch + 解析 + 创建图层并添加到地图 */
async function loadGeoJSON(
  map: Map,
  url: string,
  style: any,
  zIndex: number,
) {
  const res = await fetch(url)
  const geojson = await res.json()
  const features = new GeoJSON().readFeatures(geojson, {
    featureProjection: "EPSG:3857", // GeoJSON 默认 WGS84，自动转成视图投影
  })
  const layer = new VectorLayer({
    source: new VectorSource({ features }),
    style,
    zIndex,
  })
  map.addLayer(layer)
  return layer
}

/** 通用 Heatmap 加载器：fetch + 解析 + 创建热力图并添加到地图 */
async function loadHeatmap(
  map: Map,
  url: string,
  weightField: string,
) {
  const res = await fetch(url)
  const geojson = await res.json()
  const source = new VectorSource({
    features: new GeoJSON().readFeatures(geojson, {
      featureProjection: "EPSG:3857",
    }),
  })
  const layer = new HeatmapLayer({
    source,
    radius: 5, // 半径越大，热力图点越模糊
    blur: 7, // 模糊度越大，热力图点越模糊
    // 通过 weightField 指定的字段值来计算热力图权重，值越大，热力图点越亮
    weight: weightField
      ? (feature) => {
          const v = Number(feature.get(weightField))
          return isNaN(v) ? 0.3 : v / 5
        }
      : 1,
  })
  map.addLayer(layer)
  return { layer, source }
}

/** 初始化地图 */
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

/**
 * 图层注册表 — 传给 LayerControl 显示
 * 每加载一个业务图层就往里 push 一条记录
 */
const layerInfos = ref<LayerInfo[]>([])

// ── 样式函数（同 03-load-data） ─────────────────────────────

/**
 * 注意：styleFunction 是 OL 的回调，运行时机不确定（可能在 onMounted 之前或之后），
 * 所以这里保留 ?? 兜底，不能用 const m = map.value! 提取。
 */
const cityStyle = (feature: any) => {
  let stroke = new Stroke({
    color: 'black',
    width: 2
  })
  let fill = new Fill({
    color: 'red'
  })
  let name = feature.get("name")
  // 根据缩放级别显示或隐藏名称
  name = (map.value?.getView()?.getZoom() ?? 0) > 5 ? name : ""
  let _radius = 8, _radius2 = 6;
  // styles 数组里可以放多个 Style，OL 会按顺序渲染
  // 因为一个 Style 只能有一个 image。你要的效果是五角星 + 中间一个蓝色圆点，
  // 所以需要两个 Style 叠在一起。
  let styles = [];
  styles.push(new Style({
    stroke: stroke,
    fill: fill,
    image: new RegularShape({
      fill: fill,
      stroke: stroke,
      points: 5, // 五角星
      radius: _radius, // 外接圆半径
      radius2: _radius2, // 内接圆半径
      angle: 0 // 旋转角度
    }),
    text: new Text({
      text: name,
      textAlign: "center",
      offsetX: 12,
      font: "bold 14px Arial",
      fill: fill,
      stroke: new Stroke({
        color: "white",
        width: 2
      })
    })
  }))
  // 在五角星上再加一个蓝色圆点
  styles.push(new Style({
    geometry: feature.getGeometry(),
    image: new Circle({
      radius: 4,
      fill: new Fill({ color: "blue" }),
    })
  }))
  return styles
}

/** 县域边界样式（半透明填充 + 边界线） */
const countyStyle = (feature: any) => {
  return new Style({
    fill: new Fill({ color: "rgba(0, 120, 255, 0.08)" }),
    stroke: new Stroke({ color: "#0078ff", width: 1.5 }),
  })
}

/** 选中样式（鼠标悬停或点击时） */
const selectStyle = (feature: any) => {
  let stroke = new Stroke({
    color: 'black',
    width: 2
  });
  let fill = new Fill({
    color: 'red'
  });
  let _name = "",
    _color = "#ccc";
  if (feature.get("name") || feature.get("NAME")) {
    _name = feature.get("name") ? feature.get("name") : feature.get("NAME");
    _color = "#f00";
  }
  return new Style({
    stroke: stroke,
    fill: fill,
    image: new Circle({
      radius: 8,
      fill: new Fill({
        color: _color
      })
    }),
    text: new Text({
      text: _name,
      textAlign: "left",
      offsetX: 12,
      font: "bold 13px sans-serif",
      fill: new Fill({
        color: 'red'
      }),
      stroke: new Stroke({
        color: 'white',
        width: 2
      })
    })
  });
}

// useMap 的 onMounted 先执行（map.value 就绪），这个后执行
onMounted(async () => {
  const m = map.value! // 唯一的 !，后续用 m 不用再 ?./!

  // 加载城市点数据
  const cityLayer = await loadGeoJSON(m, publicUrl("test_data/cities.geojson"), cityStyle, 10)
  layerInfos.value.push({ id: "cities", name: "省会城市", type: "vector", layer: cityLayer })

  // 加载重庆县域边界
  const countyLayer = await loadGeoJSON(m, publicUrl("test_data/chongqing_county_border.geojson"), countyStyle, 5)
  layerInfos.value.push({ id: "county", name: "重庆县域边界", type: "vector", layer: countyLayer })

  // 加载大学热力图
  const { layer: heatmapLayer } = await loadHeatmap(m, publicUrl("test_data/university.geojson"), "")
  layerInfos.value.push({ id: "university", name: "大学热力图", type: "vector", layer: heatmapLayer })

  // 大学名称弹窗（OL Overlay：浮在地图上的 DOM 元素）
  // Overlay 帮你把地图坐标（经纬度）和 DOM 位置绑定起来，地图动它就动。
  const popupEl = document.createElement("div")
  popupEl.className = "univ-popup"
  const popup = new Overlay({
    element: popupEl,
    positioning: "bottom-center",
    offset: [0, -8],
  })
  m.addOverlay(popup)

  // 鼠标悬停
  m.on("pointermove", (evt) => {
    m.getTargetElement().style.cursor = m.hasFeatureAtPixel(evt.pixel) ? "pointer" : ""
  })

  // 点击大学 → 弹窗显示名称
  m.on("click", (evt) => {
    popup.setPosition(undefined) // 先隐藏
    m.forEachFeatureAtPixel(evt.pixel, (feature, layer) => {
      if (layer !== heatmapLayer) return
      const name = feature.get("name") || feature.get("NAME")
      if (name) {
        popupEl.innerHTML = name
        // 从 Point geometry 取精确坐标，否则用点击位置
        const geom = (feature as any).getGeometry()
        const coord = geom?.getType() === "Point" ? geom.getCoordinates() : evt.coordinate
        popup.setPosition(coord)
      }
    })
  })

  // Select 给县域边界用
  const select = new Select({
    layers: [countyLayer],
    style: (feature) => selectStyle(feature),
  })
  m.addInteraction(select)
  select.on("select", (evt) => {
    const f = evt.selected[0]
    if (f) console.log(f.get("name") || f.get("NAME"))
  })
})

</script>

<style scoped>
.map-container {
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
  align-items: flex-end;
  gap: 10px;
}
/*
  :global 穿透 scoped 限制。
  大学弹窗由 document.createElement("div") 动态创建，没有 data-v-xxx 属性。
  scoped 样式默认加上 [data-v-xxx] 选择器会匹配不到，所以用 :global 取消限制。
*/
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
