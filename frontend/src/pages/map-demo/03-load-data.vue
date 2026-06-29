<template>
  <div id="map" class="map-container" style="position: relative">
    <BasemapSwitcher :set-base-layer="setBaseLayer" />
    <BasicToolBox v-if="map" :map="map" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from "vue"
import { useMap } from "@/composables/useMap"
import { BASEMAP_LIST } from "@/utils/basemaps"
import BasemapSwitcher from "@/components/BasemapSwitcher.vue"
import BasicToolBox from "@/components/BasicToolBox.vue";
// OL模块引入
import GeoJSON from "ol/format/GeoJSON"
import { Vector as VectorSource } from "ol/source"
import { Vector as VectorLayer } from "ol/layer"
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

/** 初始化地图 */
const { map, setBaseLayer } = useMap("map", {
  layers: [BASEMAP_LIST[0].create()],
  centerLonLat: [110, 35],
  view: { zoom: 5 }
})

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

/** 县域边界样式（半透明填充 + 边界线 + 县名标注） */
const countyStyle = (feature: any) => {
  // const name = feature.get("NAME") || ""
  // 缩放级别 >= 10 才显示县名，否则文字堆叠看不清
  // const zoom = map.value?.getView()?.getZoom() ?? 0
  // const showText = zoom >= 8
  return new Style({
    fill: new Fill({ color: "rgba(0, 120, 255, 0.08)" }),
    stroke: new Stroke({ color: "#0078ff", width: 1.5 }),
    // text: showText ? new Text({
    //   text: name,
    //   font: "bold 13px Arial",
    //   fill: new Fill({ color: "#0078ff" }),
    //   stroke: new Stroke({ color: "white", width: 2 }),
    // }) : undefined,
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
    _name = feature.get("name")? feature.get("name") : feature.get("NAME");
    _color = "#f00";
  }
  return new Style({
    // 由于当前feature是point，stroke和fill属性没有任何效果
    stroke: stroke,
    fill: fill, // 要素的填充颜色
    image: new Circle({
      radius: 8,
      fill: new Fill({ // 圆形标记的填充颜色
        color: _color
      })
    }),
    text: new Text({
      text: _name,
      textAlign: "left",
      offsetX: 12, // 文本偏移量，向右偏移12像素
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
  const cityLayer = await loadGeoJSON(m, "/test_data/cities.geojson", cityStyle, 10)
  // 加载重庆县域边界
  const countyLayer = await loadGeoJSON(m, "/test_data/chongqing_county_border.geojson", countyStyle, 5)

  // 鼠标悬停 + 点击
  m.on("pointermove", (evt) => {
    if (m.hasFeatureAtPixel(evt.pixel)) {
      m.getTargetElement().style.cursor = "pointer"
    } else {
      m.getTargetElement().style.cursor = ""
    }
  })
  m.on("click", (evt) => {
    m.forEachFeatureAtPixel(evt.pixel, (feature) => {
      console.log("当前点击feature：", feature)
    })
  })

  let select = new Select({
    layers: [cityLayer, countyLayer],
    style: function (feature) {
      return selectStyle(feature)
    }
  })
  m.addInteraction(select)
  select.on("select", (evt) => {
    let features = evt.selected
    if (features.length > 0) {
      let feature = features[0]
      console.log(feature.get("name") || feature.get("NAME"));
    }
  })
})

</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
