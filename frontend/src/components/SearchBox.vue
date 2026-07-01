<template>
  <div class="search-box">
    <el-input v-model="keywords" placeholder="搜索" :prefix-icon="Search" size="large" @input="onInput" />
    <div class="search-result" v-if="searchRes.length">
      <div class="res-item" :class="{ inView: item._inView }" v-for="item in searchRes" :key="item.id"
        @click="flyTo(item.location)">
        <span class="res-name">{{ item.name }}</span>
        <span class="res-addr">{{ item.address }}</span>
        <el-tag v-if="item._inView" size="small" type="warning">当前视角</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { debounce } from "lodash"
import axios from "axios"
import { Search } from "@element-plus/icons-vue"
import { Feature } from "ol"
import { Point } from "ol/geom"
import { fromLonLat, transformExtent } from "ol/proj"
import { Vector as VectorLayer } from "ol/layer"
import { Vector as VectorSource } from "ol/source"
import { Style, Icon } from "ol/style"

const props = defineProps({
  map: { type: Object, required: true },
})

// props.map 已经是 Map 实例，不是 ref，不需要 .value
const map = props.map

const keywords = ref("")
const searchRes = ref<any[]>([])

const onSearch = () => {
  searchRes.value = []
  // 采用高德地图的搜索 API
  axios.get("https://restapi.amap.com/v3/place/text", {
    params: {
      keywords: keywords.value,
      page: 1,
      offset: 10, // 直接让后端只返回 10 条，前端就不用 slice 了
      key: "a54543e9f579aa035a1eb31d417408ac",
    },
  })
    .then((res) => {
      const pois = (res.data.pois || []) as any[]

      // — 按当前视角排序 —
      // 获取地图当前视角范围（EPSG:3857），转成 WGS84（高德用 GCJ-02，WGS84 近似够用）
      const extent = map.getView().calculateExtent()
      const extent4326 = transformExtent(extent, "EPSG:3857", "EPSG:4326")

      // 为每个 POI 标记是否在视角内，视图内排前面
      pois.forEach((p: any) => {
        const [lng, lat] = p.location.split(",").map(Number)
        // extent4326 = [minX, minY, maxX, maxY]
        p._inView = lng >= extent4326[0] && lng <= extent4326[2]
          && lat >= extent4326[1] && lat <= extent4326[3]
      })
      // sort() 返回值 <0 排前面，>0 排后面，0 不变
      pois.sort((a: any, b: any) => (b._inView ? 1 : 0) - (a._inView ? 1 : 0))

      searchRes.value = pois
    });
}

const onInput = debounce(onSearch, 500) // 输入时防抖，避免频繁请求

// 辅助函数：通过自定义标识查找图层
const getMarkerLayer = () => {
  const layers = map.getLayers().getArray()
  // 找到带有 type='flyToMarker' 标记的图层
  return layers.find((layer: any) => layer.get("name") === "search-marker")
}

const flyTo = (location: string) => {
  // 1. 查找并移除旧标记图层（完全不依赖 Vue 变量）
  const oldLayer = getMarkerLayer()
  if (oldLayer) {
    map.removeLayer(oldLayer)
    oldLayer.getSource().clear() // 清空要素，释放内存
  }

  // 2. 将高德返回的 "经度,纬度" 转成坐标数组，再转 3857
  const lonLat = location.split(",").map(Number)
  const coord = fromLonLat(lonLat)

  // 3. 创建标记要素 + 图层
  const marker = new Feature({
    geometry: new Point(coord),
  })
  const source = new VectorSource({ features: [marker] })
  const vectorLayer = new VectorLayer({
    source,
    style: new Style({
      image: new Icon({
        // OL 的 Icon({ src: "..." }) 是在运行时创建了一个 <img> 标签，浏览器去请求这个路径。
        // 字符串 "@/assets/..." 不会经过 Vite 编译，浏览器不认识 @。
        // 要在 src/assets/ 用相对路径引用，或者放到 public/ 下用根路径引用。
        src: "/icon-1.png", // 放到 public/ 下，用根路径访问
      }),
    }),
    zIndex: 10, // 浮在底图上方
  })
  vectorLayer.set("name", "search-marker") // 设置自定义标识，供 getMarkerLayer 查找
  map.addLayer(vectorLayer)

  // 4. 飞到新标记位置
  map.getView().animate({
    center: coord,
    zoom: 14,
    duration: 1000,
  })
}

</script>

<style scoped lang="scss">
// 搜索框容器 — absolute 浮在地图上
.search-box {
  position: absolute;
  left: 10px;
  top: 10px;
  width: 250px;
  z-index: 5;

  // 下拉结果列表 — absolute 脱离 .search-box 的 flex 流，浮在输入框下方
  // left: 0; right: 0 使宽度自动跟随 input 宽度（而不是由内容撑开）
  .search-result {
    position: absolute;
    top: 40px;
    left: 0;
    right: 0;
    padding: 8px 10px;
    background: #fff;
    border-radius: 5px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  // 每一行结果 — flex 让 name / address / tag 水平排列
  // gap 控制它们之间的间距，而不是用 margin（更干净）
  .res-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 4px;
    border-bottom: 1px solid #efefef;
    cursor: pointer;

    &:last-child {
      border-bottom: none
    }

    &:hover {
      background: #f5f7fa
    }

    &.inView {
      background: #fffbe6
    }

    // 当前视角内的结果：浅黄底色标识
  }

  /*
    white-space: nowrap → 文字不换行，默认会自动换行
      不加的话地址很长时名称可能被折成两行
    overflow: hidden → 超出容器的部分隐藏
    text-overflow: ellipsis → 隐藏的内容用 ... 代替
      这三条组合 = "文字在一行显示，超长了自动变 ..."
      常见于列表、表格、导航等需要固定单行的场景
    min-width: 0 → 允许 flex 子项收缩到小于内容宽度
      flex 子项默认 min-width: auto，即"不能比内容窄"
      nowrap 的文字有多长这一列就撑多宽，会把右边的 tag 挤出容器
      min-width: 0 解除这个限制，容器多窄它都能缩小
    */
  .res-name {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap; /* 不换行 */
    overflow: hidden; /* 超出隐藏 */
    text-overflow: ellipsis; /* 用 ... 代替被截断的内容 */
    min-width: 0;
  }

  // 地址 — flex: 1 占满剩余空间，长地址用省略号截断
  .res-addr {
    font-size: 12px;
    color: #999;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>